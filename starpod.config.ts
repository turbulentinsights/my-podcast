import { defineStarpodConfig } from 'starpod/config';

// Extra platform rendered by our custom Platforms component.
export const xiaoyuzhouUrl =
  'https://www.xiaoyuzhoufm.com/podcast/63e108e0e84236ee1f51bfa7';

export default defineStarpodConfig({
  blurb: '一档不很轻松的闲谈节目。闲谈也是出路。',
  description:
    '一档不很轻松的闲谈节目。闲谈也是出路。\n 本网站使用 Astro 模板 https://github.com/shipshapecode/starpod 构建，感谢小米公司开源 MiSans 字体。',
  hosts: [
    {
      name: '阵雨',
      bio: '成分复杂，生活西化',
      // Drop a photo into src/img/people/ and reference its filename here.
      img: 'liu.webp'
    },
    {
      name: '啊游',
      bio: '',
      // Drop a photo into src/img/people/ and reference its filename here.
      img: 'you.jpg'
    },
  ],
  platforms: {
    apple: 'https://podcasts.apple.com/us/podcast/逐流随想/id1670338456',
    spotify: 'https://open.spotify.com/show/0djoDogw2fN0EIXtmLg5jN?si=m-8sqqo0Q3ajQrDSbqETMQ',
    pocketCasts: 'https://pca.st/qhkh2ulz'
    // Add the platforms your show is published on; unset ones are hidden.
    // apple: 'https://podcasts.apple.com/us/podcast/your-show/id0000000000',
    // spotify: 'https://open.spotify.com/show/...',
    // overcast: 'https://overcast.fm/itunes0000000000',
    // pocketCasts: 'https://pca.st/...',
    // youtube: 'https://www.youtube.com/@yourshow'
  },
  rssFeed: 'https://feed.turbulentinsights.com/feed.xml'
  // Extra navigation links, e.g. a merch store or custom pages you add to
  // src/pages/ (see "Custom pages" in the README):
  // links: [
  //   { label: 'Store', href: 'https://example.com/store' },
  //   { label: 'Become a sponsor', href: '/sponsor' }
  // ]
});
