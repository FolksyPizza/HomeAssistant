export interface BrowserRecordingResult {
	audio: Blob;
	browserTranscriptHint?: string;
	partialTranscript?: string;
}

interface SpeechSynthesisVoiceLike {
	lang: string;
	default: boolean;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
	start(): void;
	stop(): void;
}

interface SpeechRecognitionEvent {
	results: ArrayLike<{
		isFinal: boolean;
		0: {
			transcript: string;
		};
	}>;
}

declare global {
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	}
}

export function browserMicAvailable(): boolean {
	return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function browserSpeechRecognitionAvailable(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function browserSpeechSynthesisAvailable(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function stopBrowserSpeech(): void {
	if (!browserSpeechSynthesisAvailable()) {
		return;
	}

	window.speechSynthesis.cancel();
}

function pickBrowserVoice(): SpeechSynthesisVoice | null {
	const voices = window.speechSynthesis
		.getVoices()
		.filter((voice): voice is SpeechSynthesisVoice & SpeechSynthesisVoiceLike => Boolean(voice));

	return (
		voices.find((voice) => voice.default && voice.lang.startsWith('en')) ||
		voices.find((voice) => voice.lang === 'en-US') ||
		voices.find((voice) => voice.lang.startsWith('en')) ||
		voices[0] ||
		null
	);
}

export async function speakInBrowser(text: string): Promise<void> {
	if (!browserSpeechSynthesisAvailable()) {
		return;
	}

	const spokenText = text.trim();
	if (!spokenText) {
		return;
	}

	stopBrowserSpeech();

	await new Promise<void>((resolve, reject) => {
		const utterance = new SpeechSynthesisUtterance(spokenText);
		const voice = pickBrowserVoice();
		if (voice) {
			utterance.voice = voice;
			utterance.lang = voice.lang;
		} else {
			utterance.lang = 'en-US';
		}
		utterance.rate = 0.96;
		utterance.pitch = 1;
		utterance.onend = () => resolve();
		utterance.onerror = () => reject(new Error('Browser speech synthesis failed.'));
		window.speechSynthesis.speak(utterance);
	});
}

export async function recordBrowserClip(
	onPartialTranscript?: (value: string) => void
): Promise<{
	stop: () => Promise<BrowserRecordingResult>;
}> {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true
		}
	});

	const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
		? 'audio/webm;codecs=opus'
		: 'audio/webm';
	const recorder = new MediaRecorder(stream, { mimeType });
	const chunks: BlobPart[] = [];
	let finalTranscript = '';
	let partialTranscript = '';

	const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	const recognition = Recognition ? new Recognition() : null;

	if (recognition) {
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = 'en-US';
		recognition.onresult = (event) => {
			let nextFinal = '';
			let nextPartial = '';

			for (const result of Array.from(event.results)) {
				const transcript = result[0]?.transcript?.trim();
				if (!transcript) {
					continue;
				}

				if (result.isFinal) {
					nextFinal = `${nextFinal} ${transcript}`.trim();
				} else {
					nextPartial = `${nextPartial} ${transcript}`.trim();
				}
			}

			if (nextFinal) {
				finalTranscript = nextFinal;
			}

			partialTranscript = nextPartial;
			onPartialTranscript?.(partialTranscript || finalTranscript);
		};
	}

	const stopped = new Promise<BrowserRecordingResult>((resolve, reject) => {
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunks.push(event.data);
			}
		};

		recorder.onerror = () => {
			reject(new Error('Browser recording failed.'));
		};

		recorder.onstop = () => {
			stream.getTracks().forEach((track) => track.stop());
			recognition?.stop();

			resolve({
				audio: new Blob(chunks, { type: mimeType }),
				browserTranscriptHint: finalTranscript || partialTranscript || undefined,
				partialTranscript: partialTranscript || undefined
			});
		};
	});

	recorder.start();
	recognition?.start();

	return {
		stop: async () => {
			recorder.stop();
			return stopped;
		}
	};
}
