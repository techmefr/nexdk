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
						{ label: 'Packages', slug: 'guides/packages' },
						{ label: 'Standard Schema (validators)', slug: 'guides/standard-schema' },
						{ label: 'Events and mocks', slug: 'guides/events-and-mocks' },
					],
				},
				{
					label: 'Writing a driver',
					items: [
						{ label: 'The driver contract', slug: 'guides/writing-a-driver' },
					],
				},
			],
		}),
		mdx(),
	],
});
