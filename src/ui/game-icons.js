// Small native SVG controls: crisp at every phone pixel ratio, no asset download.
const paths={
 wave:'<path d="m7 13-2-3a1.4 1.4 0 0 1 2.3-1.5L9 11V5a1.3 1.3 0 0 1 2.6 0v5-7a1.3 1.3 0 0 1 2.6 0v7-6a1.3 1.3 0 0 1 2.6 0v7-4a1.3 1.3 0 0 1 2.6 0v6.5c0 4.6-2.5 7.5-6.5 7.5-2.5 0-4.2-1.4-5.7-3.5L7 13Z"/><path d="M3 15a9 9 0 0 0 3 6M21 3l1 3"/>',
 metro:'<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M12 3v7M8 18l-2 3m10-3 2 3M8 21h8"/><path d="M8.5 14h.01m7 0h.01" stroke-width="3"/>',
 chat:'<path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 9h8m-8 4h5"/>',
 menu:[5,12,19].flatMap(y=>[5,12,19].map(x=>`<circle cx="${x}" cy="${y}" r="1.7" fill="currentColor" stroke="none"/>`)).join(''),
};
export const gameIcon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||''}</svg>`;
