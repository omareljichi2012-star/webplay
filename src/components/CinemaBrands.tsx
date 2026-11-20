export interface NetworkBrandItem {
  id: string;
  name: string;
  tvNetworkId: string;
  watchProviderId: string;
  cardBg: string;
  imageFit: 'cover' | 'contain';
  logoUrl: string;
}

export interface StudioBrandItem {
  id: string;
  name: string;
  companyId: string;
  tvCompanyId: string;
  logoUrl: string;
}

export const POPULAR_NETWORKS: NetworkBrandItem[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    tvNetworkId: '213',
    watchProviderId: '8',
    cardBg: 'bg-[#000000] border-[#232329]',
    imageFit: 'cover',
    logoUrl: '/assets/aistudio/rK1KljqmbvO9HQa1PBFLILWah72_2338594b.png',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    tvNetworkId: '2739',
    watchProviderId: '337',
    cardBg: 'bg-[#042f49] border-[#0e6f8c]/50',
    imageFit: 'cover',
    logoUrl: '/assets/aistudio/5eZ872CghnHFLB1j8grszbrx0dx_b15a1c31.png',
  },
  {
    id: 'prime-video',
    name: 'Prime Video',
    tvNetworkId: '1024',
    watchProviderId: '9',
    cardBg: 'bg-[#ffffff] border-white/80',
    imageFit: 'contain',
    logoUrl: '/assets/aistudio/gMZdpavHmxFNnLpMHwVxfqeux2g_5f99e6c7.png',
  },
  {
    id: 'hbo-max',
    name: 'HBO Max',
    tvNetworkId: '49|3186',
    watchProviderId: '1899',
    cardBg: 'bg-[#000000] border-[#232329]',
    imageFit: 'cover',
    logoUrl: '/assets/aistudio/skypuy7SXuugIQeYg0IglmzoKaS_63e2d303.png',
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    tvNetworkId: '2552',
    watchProviderId: '350',
    cardBg: 'bg-[#141418] border-[#2e2e36]',
    imageFit: 'contain',
    logoUrl: '/assets/aistudio/v9SnyvYt0U3KGgBH3Sbh3z4yODe_34da4985.png',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    tvNetworkId: '453',
    watchProviderId: '15',
    cardBg: 'bg-[#1ce783] border-[#34d399]/50',
    imageFit: 'cover',
    logoUrl: '/assets/aistudio/44uAnmSqvA4yBOdbPWN8YgQHjWm_79df3ce2.png',
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    tvNetworkId: '1112',
    watchProviderId: '283',
    cardBg: 'bg-[#f47521] border-[#fb923c]/60',
    imageFit: 'cover',
    logoUrl: '/assets/aistudio/uFL3c4Cq8M6WoLymlC5Y8bmGytV_3a54824b.png',
  },
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    tvNetworkId: '4330',
    watchProviderId: '531',
    cardBg: 'bg-[#0064ff] border-[#3b82f6]/50',
    imageFit: 'cover',
    logoUrl: '/assets/aistudio/pkx3klJlwW5JdtaulvDx6hDNtch_e0901195.png',
  },
];

export const FEATURED_STUDIOS: StudioBrandItem[] = [
  {
    id: 'marvel',
    name: 'Marvel Studios',
    companyId: '420',
    tvCompanyId: '420|38679',
    logoUrl: '/assets/aistudio/mIkZDuulwMPzESbzF9lg3rD8CcO_2a92915c.png',
  },
  {
    id: 'pixar',
    name: 'Pixar',
    companyId: '3',
    tvCompanyId: '3',
    logoUrl: '/assets/aistudio/1TjvGVDMYsj6JBxOAkUHpPEwLf7_e81cc95b.png',
  },
  {
    id: 'walt-disney',
    name: 'Walt Disney Pictures',
    companyId: '2',
    tvCompanyId: '2|3475',
    logoUrl: '/assets/aistudio/wdrCwmRnLFJhEoH8GSfymY85KHT_69451e6d.png',
  },
  {
    id: 'warner-bros',
    name: 'Warner Bros. Pictures',
    companyId: '174',
    tvCompanyId: '174|1957',
    logoUrl: '/assets/aistudio/zhD3hhtKB5qyv7ZeL4uLpNxgMVU_2f1cfa50.png',
  },
  {
    id: 'universal',
    name: 'Universal Pictures',
    companyId: '33',
    tvCompanyId: '33|26727',
    logoUrl: '/assets/aistudio/8lvHyhjr8oUKOOy2dKXoALWKdp0_f0640039.png',
  },
  {
    id: 'dreamworks',
    name: 'DreamWorks',
    companyId: '7|521',
    tvCompanyId: '7|521|42141',
    logoUrl: '/assets/aistudio/3BPX5VGBov8SDqTV7wC1L1xShAS_f7daa60c.png',
  },
  {
    id: 'paramount',
    name: 'Paramount Pictures',
    companyId: '4',
    tvCompanyId: '4|9223',
    logoUrl: '/assets/aistudio/jay6WcMgagAklUt7i9Euwj1pzTF_53e11ad3.png',
  },
  {
    id: 'columbia',
    name: 'Columbia Pictures',
    companyId: '5',
    tvCompanyId: '5|11073',
    logoUrl: '/assets/aistudio/71BqEFAF4V3qjjMPCpLuyJFB9A_8bb612c9.png',
  },
  {
    id: '20th-century',
    name: '20th Century Studios',
    companyId: '25|127928',
    tvCompanyId: '25|127928|1556',
    logoUrl: '/assets/aistudio/nM2MfoMqzJQRiSynsDabOtFKetD_511ae70b.png',
  },
  {
    id: 'legendary',
    name: 'Legendary Pictures',
    companyId: '923',
    tvCompanyId: '923|54629',
    logoUrl: '/assets/aistudio/5UQsZrfbfG2dYJbx8DxfoTr2Bvu_9ca85136.png',
  },
];

export const FEATURED_COLLECTION_IDS = [
  10,     // Star Wars Collection
  1241,   // Harry Potter Collection
  119,    // The Lord of the Rings Collection
  528,    // The Terminator Collection
  2344,   // The Matrix Collection
  86311,  // The Avengers Collection
  263,    // The Dark Knight Collection
  328,    // Jurassic Park Collection
  9485,   // Fast & Furious Collection
  748,    // X-Men Collection
];

export const COLLECTION_IMAGE_OVERRIDES: Record<number, string> = {
  10: '/assets/aistudio/iY2ujEY2m68OTTlPFTiHub9joHS_a362418d.jpg',
  1241: '/assets/aistudio/kmEsQL2vOTA0jnM28fXS45Ky8kX_021661f4.jpg',
  119: '/assets/aistudio/bccR2CGTWVVSZAG0yqmy3DIvhTX_a7806be9.jpg',
  528: '/assets/aistudio/sCnBEw2Yu6foEjs4Xb4eMddYHRo_05139732.jpg',
  2344: '/assets/aistudio/bRm2DEgUiYciDw3myHuYFInD7la_d2fa34d2.jpg',
  86311: '/assets/aistudio/2UNUv4NJdC36E5myDHACBJ99EwL_1d6bef68.jpg',
  263: '/assets/aistudio/xyhrCEdB4XRkelfVsqXeUZ6rLHi_70ab48ed.jpg',
  328: '/assets/aistudio/njFixYzIxX8jsn6KMSEtAzi4avi_b40c8535.jpg',
  9485: '/assets/aistudio/z5A5W3WYJc3UVEWljSGwdjDgQ0j_2d166ea3.jpg',
  748: '/assets/aistudio/ykVHlrE3aSvHYeIXOrWDsYZ18vv_9d6e2781.jpg',
};
