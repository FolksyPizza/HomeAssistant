import {
	AMBIENT_PHOTO_CATEGORIES,
	type AmbientPhoto,
	type AmbientPhotoCategory
} from '$lib/types';

export const ambientPhotoCategories: AmbientPhotoCategory[] = [...AMBIENT_PHOTO_CATEGORIES];

export const ambientPhotoCategoryLabels: Record<AmbientPhotoCategory, string> = {
	nature: 'Nature',
	landscapes: 'Landscapes',
	forests: 'Forests',
	mountains: 'Mountains',
	lakes: 'Lakes',
	oceans: 'Oceans',
	deserts: 'Deserts',
	landmarks: 'Landmarks',
	cities: 'Cities',
	architecture: 'Architecture',
	seasonal: 'Seasonal',
	'sunrise-sunset': 'Sunrise / Sunset',
	'night-sky': 'Night Sky'
};

export const defaultAmbientPhotoCategories: AmbientPhotoCategory[] = [
	'nature',
	'landscapes',
	'landmarks',
	'cities',
	'seasonal',
	'sunrise-sunset'
];

export const bundledAmbientPhotos: AmbientPhoto[] = [
	{
		id: 'autumn-lake-landscape',
		src: '/photos/curated/autumn-lake-landscape.jpg',
		categories: ['nature', 'landscapes', 'forests', 'lakes', 'seasonal'],
		title: 'Autumn Lake Landscape',
		width: 5799,
		height: 3866,
		location: 'Unknown lake',
		photographerCredit: "Holly's Coastal View",
		creditUrl: 'https://commons.wikimedia.org/wiki/File:Autumn_Lake_Landscape.jpg',
		sourceUrl: 'https://commons.wikimedia.org/wiki/File:Autumn_Lake_Landscape.jpg'
	},
	{
		id: 'matterhorn-night',
		src: '/photos/curated/matterhorn-night.jpg',
		categories: ['nature', 'landscapes', 'mountains', 'night-sky'],
		title: 'Matterhorn at Night',
		width: 7952,
		height: 5304,
		location: 'Zermatt, Switzerland',
		photographerCredit: '風景写真が好き',
		creditUrl: 'https://commons.wikimedia.org/wiki/File:20240622_Matterhorn.jpg',
		sourceUrl: 'https://commons.wikimedia.org/wiki/File:20240622_Matterhorn.jpg'
	},
	{
		id: 'golden-gate-baker-beach',
		src: '/photos/curated/golden-gate-baker-beach.jpg',
		categories: ['landmarks', 'cities', 'architecture', 'oceans', 'sunrise-sunset'],
		title: 'Golden Gate Bridge at Dusk',
		width: 5184,
		height: 3456,
		location: 'San Francisco, California',
		photographerCredit: 'Rita Morais',
		creditUrl:
			'https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge,_San_Francisco,_United_States_(Unsplash_-a4tzI2fNW8).jpg',
		sourceUrl:
			'https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge,_San_Francisco,_United_States_(Unsplash_-a4tzI2fNW8).jpg'
	},
	{
		id: 'tower-bridge-night',
		src: '/photos/curated/tower-bridge-night.jpg',
		categories: ['landmarks', 'cities', 'architecture', 'night-sky'],
		title: 'Tower Bridge from Butler Wharf',
		width: 4608,
		height: 3456,
		location: 'London, United Kingdom',
		photographerCredit: 'Acabashi',
		creditUrl:
			'https://commons.wikimedia.org/wiki/File:Tower_Bridge_Butler%27s_Wharf_Pier_at_night_Shad_Thames_Southwark_London_England_01.jpg',
		sourceUrl:
			'https://commons.wikimedia.org/wiki/File:Tower_Bridge_Butler%27s_Wharf_Pier_at_night_Shad_Thames_Southwark_London_England_01.jpg'
	},
	{
		id: 'seattle-skyline',
		src: '/photos/curated/seattle-skyline.jpg',
		categories: ['cities', 'architecture', 'landmarks'],
		title: 'Downtown Seattle',
		width: 4013,
		height: 2405,
		location: 'Seattle, Washington',
		photographerCredit: 'David Brodbeck',
		creditUrl: 'https://commons.wikimedia.org/wiki/File:SeattleI5Skyline.jpg',
		sourceUrl: 'https://commons.wikimedia.org/wiki/File:SeattleI5Skyline.jpg'
	},
	{
		id: 'san-francisco-skyline',
		src: '/photos/curated/san-francisco-skyline.jpg',
		categories: ['cities', 'oceans', 'sunrise-sunset', 'architecture'],
		title: 'Mission Bay Sunset',
		width: 4608,
		height: 3072,
		location: 'California, USA',
		photographerCredit: 'Frank Schulenburg',
		creditUrl:
			'https://commons.wikimedia.org/wiki/File:A_view_of_the_San_Francisco_Skyline_from_Mission_Bay_at_Sunset.jpg',
		sourceUrl:
			'https://commons.wikimedia.org/wiki/File:A_view_of_the_San_Francisco_Skyline_from_Mission_Bay_at_Sunset.jpg'
	},
	{
		id: 'yosemite-valley',
		src: '/photos/curated/yosemite-valley.jpg',
		categories: ['nature', 'landscapes', 'mountains', 'forests'],
		title: 'Yosemite Valley',
		width: 4288,
		height: 2848,
		location: 'Yosemite National Park, California',
		photographerCredit: 'Diliff',
		creditUrl: 'https://commons.wikimedia.org/wiki/File:Yosemite_valley.jpg',
		sourceUrl: 'https://commons.wikimedia.org/wiki/File:Yosemite_valley.jpg'
	}
];

export const bundledAmbientFallbackId = 'yosemite-valley';
