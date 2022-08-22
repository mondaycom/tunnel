// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'monday.com Tunnel',
  tagline: 'Easily test your local app on Monday.com',
  url: 'https://your-docusaurus-test-site.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'mondaycom', // Usually your GitHub org/user name.
  projectName: 'tunnel', // Usually your repo name.
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/mondaycom/tunnel/edit/main/packages/docs/docs',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Tunnel',
        logo: {
          alt: 'Monday Logo',
          src: 'img/logo-text.svg',
          srcDark: 'img/logo-text-dark.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'Client/index',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://monday.com',
            label: 'monday.com',
            position: 'right',
          },
          {
            href: 'https://github.com/mondaycom/tunnel',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Community forum',
                href: 'https://community.monday.com/',
              },
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/monday.com',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/mondaydotcom',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/mondaycom/tunnel',
              },
            ],
          },
        ],
        copyright: `All Rights Reserved © monday.com`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
