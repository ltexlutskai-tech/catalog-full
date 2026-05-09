/* L-TEX inline SVG icons (Lucide-compatible)
   Usage: ICONS.heart() -> svg string; or document.querySelector('[data-icon="heart"]').innerHTML = ICONS.heart()
   All icons render at currentColor with stroke-width:2 (Lucide style). */
window.ICONS = (() => {
  const svg = (path, opts = {}) => {
    const w = opts.size || 20;
    const fill = opts.fill || 'none';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  };
  return {
    heart: (o) => svg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', o),
    heartFilled: (o) => svg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', { ...o, fill: 'currentColor' }),
    cart: (o) => svg('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>', o),
    search: (o) => svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', o),
    layoutGrid: (o) => svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', o),
    list: (o) => svg('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>', o),
    filter: (o) => svg('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', o),
    play: (o) => svg('<polygon points="6 3 20 12 6 21 6 3"/>', { ...o, fill: 'currentColor' }),
    video: (o) => svg('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>', o),
    chevronLeft: (o) => svg('<path d="m15 18-6-6 6-6"/>', o),
    chevronRight: (o) => svg('<path d="m9 18 6-6-6-6"/>', o),
    chevronDown: (o) => svg('<path d="m6 9 6 6 6-6"/>', o),
    x: (o) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', o),
    plus: (o) => svg('<path d="M5 12h14"/><path d="M12 5v14"/>', o),
    check: (o) => svg('<path d="M20 6 9 17l-5-5"/>', o),
    menu: (o) => svg('<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>', o),
    user: (o) => svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', o),
    phone: (o) => svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>', o),
    truck: (o) => svg('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>', o),
    package: (o) => svg('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>', o),
    clock: (o) => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', o),
    scale: (o) => svg('<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>', o),
    shieldCheck: (o) => svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>', o),
    star: (o) => svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', o),
    send: (o) => svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', o),
    messageCircle: (o) => svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', o),
    mapPin: (o) => svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>', o),
    mail: (o) => svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', o),
    zap: (o) => svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', o),
    eye: (o) => svg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', o),
    home: (o) => svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/>', o),
    arrowLeft: (o) => svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', o),
    arrowRight: (o) => svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', o),
    sliders: (o) => svg('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>', o),
    trash: (o) => svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', o),
    share: (o) => svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>', o),
    info: (o) => svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>', o),
    spinner: (o) => `<svg xmlns="http://www.w3.org/2000/svg" width="${o?.size||20}" height="${o?.size||20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
  };
})();

/* spinner animation helper class */
(function(){
  if(document.getElementById('icons-spin-style')) return;
  const s = document.createElement('style');
  s.id = 'icons-spin-style';
  s.textContent = '@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}';
  document.head.appendChild(s);
})();
