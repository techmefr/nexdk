// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

const base = '/nexdk';

const SIDEBAR_ICONS = [
	'compass', 'workflow', 'layout-grid', 'shield-check', 'radio',
	'globe', 'wrench', 'file-code', 'puzzle', 'database', 'cloud',
	'zap', 'hexagon', 'server',
];

const sidebarIconCss = SIDEBAR_ICONS.map(
	(name) => `.icon-${name}{--icon-src:url('${base}/icons/${name}.svg')}`
).join('');

export default defineConfig({
	site: 'https://techmefr.github.io',
	base,
	integrations: [
		starlight({
			title: 'nexdk',
			description: 'A frontend SDK that talks to any backend — REST, GraphQL or WebSocket — through one grammar.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/techmefr/nexdk' },
			],
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
				{ tag: 'meta', attrs: { property: 'og:site_name', content: 'nexdk' } },
				{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
				{ tag: 'style', content: sidebarIconCss },
			],
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Introduction', slug: 'introduction', attrs: { class: 'sidebar-icon icon-compass' } },
						{ label: 'Anatomy of a call', slug: 'guides/anatomy-of-a-call', attrs: { class: 'sidebar-icon icon-workflow' } },
					],
				},
				{
					label: 'Core concepts',
					items: [
						{ label: 'Packages overview', slug: 'guides/packages', attrs: { class: 'sidebar-icon icon-layout-grid' } },
						{ label: 'Standard Schema (validators)', slug: 'guides/standard-schema', attrs: { class: 'sidebar-icon icon-shield-check' } },
						{ label: 'Events', slug: 'guides/events', attrs: { class: 'sidebar-icon icon-radio' } },
					],
				},
				{
					label: 'Packages',
					items: [
						{ label: '@nexdk/http (REST toolkit)', slug: 'packages/http', attrs: { class: 'sidebar-icon icon-globe' } },
						{ label: '@nexdk/hooks (Vue forms)', slug: 'packages/hooks', attrs: { class: 'sidebar-icon icon-puzzle' } },
					],
				},
				{
					label: 'Drivers',
					items: [
						{ label: 'Overview', slug: 'drivers', attrs: { class: 'sidebar-icon icon-puzzle' } },
						{ label: '@nexdk/driver-lomkit', slug: 'drivers/lomkit', attrs: { class: 'sidebar-icon icon-database' } },
						{ label: '@nexdk/driver-nhost', slug: 'drivers/nhost', attrs: { class: 'sidebar-icon icon-cloud' } },
						{ label: '@nexdk/driver-supabase', slug: 'drivers/supabase', attrs: { class: 'sidebar-icon icon-zap' } },
						{ label: '@nexdk/driver-nest', slug: 'drivers/nest', attrs: { class: 'sidebar-icon icon-hexagon' } },
						{ label: '@nexdk/driver-symfony', slug: 'drivers/symfony', attrs: { class: 'sidebar-icon icon-server' } },
					],
				},
				{
					label: 'Writing a driver',
					items: [
						{ label: 'The driver contract', slug: 'guides/writing-a-driver', attrs: { class: 'sidebar-icon icon-wrench' } },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'nexdk API', slug: 'reference/nexdk', attrs: { class: 'sidebar-icon icon-file-code' } },
					],
				},
			],
		}),
		mdx(),
	],
});
