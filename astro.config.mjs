// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

export default defineConfig({
	site: 'https://techmefr.github.io',
	base: '/nexdk',
	integrations: [
		starlight({
			title: 'nexdk',
			description: 'A frontend SDK that talks to any backend — REST, GraphQL or WebSocket — through one grammar.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/techmefr/pilota/tree/main/packages/nexdk' },
			],
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
				{ tag: 'meta', attrs: { property: 'og:site_name', content: 'nexdk' } },
				{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
			],
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Anatomy of a call', slug: 'guides/anatomy-of-a-call' },
					],
				},
				{
					label: 'Core concepts',
					items: [
						{ label: 'Packages overview', slug: 'guides/packages' },
						{ label: 'Standard Schema (validators)', slug: 'guides/standard-schema' },
						{ label: 'Events and mocks', slug: 'guides/events-and-mocks' },
					],
				},
				{
					label: 'Packages',
					items: [
						{ label: 'beepr (events)', slug: 'packages/beepr' },
						{ label: 'chaff (mocks)', slug: 'packages/chaff' },
						{ label: '@nexdk/http (REST toolkit)', slug: 'packages/http' },
					],
				},
				{
					label: 'Drivers',
					items: [
						{ label: '@nexdk/driver-lomkit', slug: 'drivers/lomkit' },
						{ label: '@nexdk/driver-nhost', slug: 'drivers/nhost' },
						{ label: '@nexdk/driver-supabase', slug: 'drivers/supabase' },
						{ label: '@nexdk/driver-nest', slug: 'drivers/nest' },
						{ label: '@nexdk/driver-symfony', slug: 'drivers/symfony' },
					],
				},
				{
					label: 'Writing a driver',
					items: [
						{ label: 'The driver contract', slug: 'guides/writing-a-driver' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'nexdk API', slug: 'reference/nexdk' },
					],
				},
			],
		}),
		mdx(),
	],
});
