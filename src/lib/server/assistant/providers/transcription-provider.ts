import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getRuntimeConfig } from '$lib/server/runtime';
import type { AssistantTranscriptResult, ServiceConnection } from '$lib/types';

const execFileAsync = promisify(execFile);

export interface TranscriptionProvider {
	id: string;
	health(): Promise<ServiceConnection>;
	transcribe(audio: File, browserTranscriptHint?: string): Promise<AssistantTranscriptResult>;
}

async function checkWhisperHealth(serviceUrl: string): Promise<ServiceConnection> {
	try {
		const startedAt = Date.now();
		const response = await fetch(new URL('/health', serviceUrl), {
			method: 'GET',
			signal: AbortSignal.timeout(4000)
		});
		return {
			id: 'transcription',
			label: 'Transcription',
			target: serviceUrl,
			state: response.ok ? 'online' : 'offline',
			detail: response.ok
				? 'Whisper transcription service reachable.'
				: `Whisper service returned ${response.status}.`,
			latencyMs: Date.now() - startedAt
		};
	} catch (error) {
		return {
			id: 'transcription',
			label: 'Transcription',
			target: serviceUrl,
			state: 'offline',
			detail: error instanceof Error ? error.message : 'Unknown transcription error'
		};
	}
}

async function fileExists(path: string | undefined): Promise<boolean> {
	if (!path) {
		return false;
	}

	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function commandExists(command: string): Promise<boolean> {
	try {
		await execFileAsync('which', [command], { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

function parseWhisperTranscript(raw: string): string {
	const lines = raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) {
		return '';
	}

	const lastLine = lines[lines.length - 1];
	return lastLine.includes(']') ? lastLine.split(']', 2)[1]?.trim() || '' : lastLine;
}

async function convertAudioToWav(inputPath: string, outputPath: string): Promise<void> {
	await execFileAsync(
		'ffmpeg',
		[
			'-y',
			'-i',
			inputPath,
			'-ac',
			'1',
			'-ar',
			'16000',
			'-vn',
			'-f',
			'wav',
			outputPath
		],
		{
			timeout: 90000,
			maxBuffer: 1024 * 1024 * 4
		}
	);
}

async function transcribeWithLocalWhisper(audio: File): Promise<AssistantTranscriptResult> {
	const runtime = getRuntimeConfig();
	const { whisperCli, whisperModel } = runtime.assistant.piVoice;
	const workspace = await mkdtemp(join(tmpdir(), 'smart-display-transcribe-'));
	const inputExtension = extname(audio.name || '') || '.webm';
	const inputPath = join(workspace, `input${inputExtension}`);
	const outputPath = join(workspace, 'transcoded.wav');

	try {
		const bytes = new Uint8Array(await audio.arrayBuffer());
		await writeFile(inputPath, bytes);
		await convertAudioToWav(inputPath, outputPath);

		const { stdout, stderr } = await execFileAsync(
			whisperCli,
			['-m', whisperModel, '-l', 'en', '-t', '4', '-f', outputPath],
			{
				timeout: 90000,
				maxBuffer: 1024 * 1024 * 4
			}
		).catch((error: Error & { stdout?: string; stderr?: string }) => {
			const message = error.stderr?.trim() || error.stdout?.trim() || error.message;
			throw new Error(`whisper.cpp failed: ${message}`);
		});

		const transcript = parseWhisperTranscript(stdout);
		if (!transcript.trim()) {
			const message = stderr?.trim() || 'whisper.cpp did not return a transcript.';
			throw new Error(message);
		}

		return {
			transcript: transcript.trim(),
			provider: 'local-whisper',
			note: 'Transcribed locally with whisper.cpp on the Pi.'
		};
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}

class WhisperServiceTranscriptionProvider implements TranscriptionProvider {
	id = 'whisper-service';

	async health(): Promise<ServiceConnection> {
		const runtime = getRuntimeConfig();
		const serviceUrl = runtime.assistant.transcriptionServiceUrl;
		if (!serviceUrl) {
			return {
				id: 'transcription',
				label: 'Transcription',
				target: 'browser transcript hint',
				state: 'degraded',
				detail: 'No Whisper service configured. Browser transcript hints remain the current fallback.'
			};
		}

		return checkWhisperHealth(serviceUrl);
	}

	async transcribe(
		audio: File,
		browserTranscriptHint?: string
	): Promise<AssistantTranscriptResult> {
		const runtime = getRuntimeConfig();
		const serviceUrl = runtime.assistant.transcriptionServiceUrl;
		if (!serviceUrl) {
			throw new Error('No Whisper service configured.');
		}

		const formData = new FormData();
		formData.set('audio', audio, audio.name);

		const response = await fetch(new URL('/transcribe', serviceUrl), {
			method: 'POST',
			body: formData,
			signal: AbortSignal.timeout(90000)
		});

		if (!response.ok) {
			throw new Error(`Whisper service returned ${response.status}`);
		}

		const payload = (await response.json()) as {
			transcript?: string;
			partialTranscript?: string;
			durationSeconds?: number;
		};

		return {
			transcript: payload.transcript?.trim() || browserTranscriptHint?.trim() || '',
			partialTranscript: payload.partialTranscript?.trim() || undefined,
			audioSeconds: payload.durationSeconds,
			provider: 'whisper-service'
		};
	}
}

class LocalWhisperTranscriptionProvider implements TranscriptionProvider {
	id = 'local-whisper';

	async health(): Promise<ServiceConnection> {
		const runtime = getRuntimeConfig();
		const whisperCliExists = await fileExists(runtime.assistant.piVoice.whisperCli);
		const whisperModelExists = await fileExists(runtime.assistant.piVoice.whisperModel);
		const ffmpegExists = await commandExists('ffmpeg');
		const ready = whisperCliExists && whisperModelExists && ffmpegExists;

		return {
			id: 'transcription',
			label: 'Transcription',
			target: runtime.assistant.piVoice.whisperCli,
			state: ready ? 'online' : 'degraded',
			detail: ready
				? 'Browser and Pi audio can be transcribed locally with whisper.cpp.'
				: 'Local whisper.cpp transcription is missing ffmpeg, the CLI, or the model.'
		};
	}

	async transcribe(
		audio: File,
		browserTranscriptHint?: string
	): Promise<AssistantTranscriptResult> {
		try {
			const result = await transcribeWithLocalWhisper(audio);
			return {
				...result,
				partialTranscript: browserTranscriptHint?.trim() || undefined
			};
		} catch (error) {
			if (browserTranscriptHint?.trim()) {
				return {
					transcript: browserTranscriptHint.trim(),
					partialTranscript: browserTranscriptHint.trim(),
					provider: 'mock-browser-hint',
					note:
						error instanceof Error
							? `Local whisper.cpp failed; used the browser transcript hint instead. ${error.message}`
							: 'Local whisper.cpp failed; used the browser transcript hint instead.'
				};
			}

			throw error;
		}
	}
}

class BrowserHintTranscriptionProvider implements TranscriptionProvider {
	id = 'mock-browser-hint';

	async health(): Promise<ServiceConnection> {
		return {
			id: 'transcription',
			label: 'Transcription',
			target: 'browser transcript hint',
			state: 'degraded',
			detail: 'No Whisper transcription backend is configured.'
		};
	}

	async transcribe(
		_audio: File,
		browserTranscriptHint?: string
	): Promise<AssistantTranscriptResult> {
		const transcript =
			browserTranscriptHint?.trim() ||
			'Audio captured. Configure Whisper or Pi-local transcription to get a transcript.';
		return {
			transcript,
			partialTranscript: browserTranscriptHint?.trim() || undefined,
			provider: 'mock-browser-hint',
			note: browserTranscriptHint
				? 'Used the browser transcript hint.'
				: 'No transcription backend is configured yet.'
		};
	}
}

export function getTranscriptionProvider(): TranscriptionProvider {
	const runtime = getRuntimeConfig();
	if (runtime.assistant.transcriptionServiceUrl) {
		return new WhisperServiceTranscriptionProvider();
	}

	if (runtime.assistant.piVoiceServiceEnabled) {
		return new LocalWhisperTranscriptionProvider();
	}

	return new BrowserHintTranscriptionProvider();
}
