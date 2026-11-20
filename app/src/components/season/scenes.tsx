import type { CSSProperties } from 'react';

import type { Season } from '@/lib/season';

// The four seasons' decor (from the old MakonBook's V70 themes, SATMAKON's
// own drawings): each is a corner piece at the top right and a scene at the
// bottom right, both SVG, animated in CSS (.mbs-* in styles.css). Summer and
// winter have a day and a night sky (.mbs-day / .mbs-night follow the theme).

const delay = (d: string) => ({ '--d': d }) as CSSProperties;

/** Bahor, Navro‘z: sumalak in the kazan, peach blossom, tulips. */
export function SpringScene() {
  return (
    <>
      <svg className="mbs-corner" viewBox="0 0 360 260" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" focusable="false">
        <defs>
          <g id="mbsSpBloom">
            <g fill="#fbb6ce">
              <ellipse cx="0" cy="-9" rx="7.5" ry="10"/>
              <ellipse cx="0" cy="-9" rx="7.5" ry="10" transform="rotate(72)"/>
              <ellipse cx="0" cy="-9" rx="7.5" ry="10" transform="rotate(144)"/>
              <ellipse cx="0" cy="-9" rx="7.5" ry="10" transform="rotate(216)"/>
              <ellipse cx="0" cy="-9" rx="7.5" ry="10" transform="rotate(288)"/>
            </g>
            <g fill="#f78fb3" opacity=".55">
              <ellipse cx="0" cy="-6" rx="3.2" ry="5"/>
              <ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(72)"/>
              <ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(144)"/>
              <ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(216)"/>
              <ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(288)"/>
            </g>
            <circle r="3.6" fill="#c2255c"/>
            <g fill="#ffd43b"><circle cx="0" cy="-5.5" r="1.2"/><circle cx="4.8" cy="-2.2" r="1.2"/><circle cx="3.2" cy="4.4" r="1.2"/><circle cx="-3.2" cy="4.4" r="1.2"/><circle cx="-4.8" cy="-2.2" r="1.2"/></g>
          </g>
          <path id="mbsSpBud" d="M0 0C-5-4-5-12 0-16C5-12 5-4 0 0Z" fill="#e64980"/>
          <path id="mbsSpLeaf" d="M0 0C6-4 16-4 22 0C16 4 6 4 0 0Z" fill="#69b34c"/>
        </defs>
        <g className="mbs-sway-branch">
          <path d="M362 22C300 30 252 50 202 70C150 90 110 98 60 120" fill="none" stroke="#6b4630" strokeWidth="9" strokeLinecap="round"/>
          <path d="M244 56C230 88 234 120 220 152" fill="none" stroke="#6b4630" strokeWidth="5" strokeLinecap="round"/>
          <path d="M152 88C140 62 122 48 98 40" fill="none" stroke="#6b4630" strokeWidth="4" strokeLinecap="round"/>
          <path d="M300 34C292 60 296 82 286 104" fill="none" stroke="#6b4630" strokeWidth="4" strokeLinecap="round"/>
          <use href="#mbsSpLeaf" transform="translate(196 72) rotate(140)"/>
          <use href="#mbsSpLeaf" transform="translate(236 92) rotate(30) scale(.8)"/>
          <use href="#mbsSpLeaf" transform="translate(120 98) rotate(160) scale(.8)"/>
          <use href="#mbsSpLeaf" transform="translate(292 70) rotate(20) scale(.7)"/>
          <use href="#mbsSpBloom" transform="translate(64 120) scale(1.15)"/>
          <use href="#mbsSpBloom" transform="translate(100 42) scale(.9)"/>
          <use href="#mbsSpBloom" transform="translate(150 92) scale(1.05)"/>
          <use href="#mbsSpBloom" transform="translate(222 152) scale(1.1)"/>
          <use href="#mbsSpBloom" transform="translate(206 68) scale(.8)"/>
          <use href="#mbsSpBloom" transform="translate(286 104) scale(.95)"/>
          <use href="#mbsSpBloom" transform="translate(262 46) scale(.75)"/>
          <use href="#mbsSpBloom" transform="translate(330 30) scale(.85)"/>
          <use href="#mbsSpBud" transform="translate(232 122) rotate(200)"/>
          <use href="#mbsSpBud" transform="translate(178 80) rotate(20) scale(.8)"/>
          <use href="#mbsSpBud" transform="translate(84 112) rotate(-40) scale(.8)"/>
          <use href="#mbsSpBud" transform="translate(312 44) rotate(170) scale(.8)"/>
        </g>
      </svg>
      <svg className="mbs-scene" viewBox="0 0 640 420" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="mbsSpKazan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#55505c"/><stop offset="1" stopColor="#1e1a23"/></linearGradient>
          <radialGradient id="mbsSpSumalak" cx="50%" cy="38%" r="65%"><stop offset="0" stopColor="#94603f"/><stop offset="1" stopColor="#5b3521"/></radialGradient>
          <radialGradient id="mbsSpGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffb347" stopOpacity=".75"/><stop offset="1" stopColor="#ff7a18" stopOpacity="0"/></radialGradient>
          <g id="mbsSpTulip">
            <path d="M0 0C-1-18 1-34 0-52" fill="none" stroke="#3f8f3a" strokeWidth="3" strokeLinecap="round"/>
            <path d="M0-6C-14-12-18-28-14-40C-8-30-4-20 0-14Z" fill="#5fb24e"/>
            <path d="M0-50C-11-52-13-66-8-76L-4-68L0-79L4-68L8-76C13-66 11-52 0-50Z" fill="#e5383b"/>
            <path d="M0-50C-5-54-5-66 0-75C5-66 5-54 0-50Z" fill="#b5161e"/>
          </g>
        </defs>
        <path d="M0 420V372C90 344 170 338 262 350C352 362 430 330 520 318C570 312 610 314 640 320V420Z" fill="#cfe8c4"/>
        <path d="M0 420V394C120 374 230 382 330 390C440 398 540 374 640 368V420Z" fill="#a8d69a"/>
        <g className="mbs-sway" style={delay('0s')}><use href="#mbsSpTulip" transform="translate(48 392)"/></g>
        <g className="mbs-sway" style={delay('-1.4s')}><use href="#mbsSpTulip" transform="translate(84 396) scale(.82)"/></g>
        <g className="mbs-sway" style={delay('-2.6s')}><use href="#mbsSpTulip" transform="translate(126 390) scale(1.05)"/></g>
        <g className="mbs-sway" style={delay('-.7s')}><use href="#mbsSpTulip" transform="translate(166 398) scale(.72)"/></g>
        <g className="mbs-sway" style={delay('-3.1s')}><use href="#mbsSpTulip" transform="translate(206 394) scale(.9)"/></g>
        {/* ko'k: sprouted wheat, the heart of sumalak */}
        <g className="mbs-sway" style={delay('-1.9s')}>
          <g strokeLinecap="round" fill="none" strokeWidth="3">
            <path d="M296 380C294 362 290 350 284 338" stroke="#5fb24e"/><path d="M304 380C304 360 302 346 300 330" stroke="#7ccc63"/>
            <path d="M312 380C314 362 318 348 322 334" stroke="#5fb24e"/><path d="M320 380C324 364 330 354 338 344" stroke="#7ccc63"/>
            <path d="M328 380C330 366 336 356 344 350" stroke="#5fb24e"/><path d="M290 380C286 368 280 360 272 352" stroke="#7ccc63"/>
          </g>
        </g>
        <path d="M276 378H352Q346 400 314 402Q282 400 276 378Z" fill="#f1e3c6"/>
        <path d="M279 384H349" stroke="#2f6db5" strokeWidth="3"/>
        {/* o'choq (clay hearth) and kazan */}
        <ellipse cx="480" cy="372" rx="120" ry="40" fill="url(#mbsSpGlow)" className="mbs-flicker-glow"/>
        <path d="M392 300C392 350 432 374 480 374C528 374 568 350 568 300Z" fill="url(#mbsSpKazan)"/>
        <path d="M404 312C410 340 430 356 452 362" fill="none" stroke="#8a8494" strokeWidth="5" strokeLinecap="round" opacity=".55"/>
        <ellipse cx="480" cy="300" rx="92" ry="16" fill="#2b2631"/>
        <ellipse cx="480" cy="301" rx="82" ry="11" fill="url(#mbsSpSumalak)"/>
        <g fill="#b07b55" className="mbs-bubbles"><circle cx="458" cy="301" r="3"/><circle cx="500" cy="303" r="2.4"/><circle cx="482" cy="298" r="2"/></g>
        <rect x="380" y="296" width="14" height="9" rx="4" fill="#2b2631"/><rect x="566" y="296" width="14" height="9" rx="4" fill="#2b2631"/>
        <path d="M396 404C396 360 408 338 426 330H534C552 338 564 360 564 404Z" fill="#c98b5e"/>
        <path d="M396 404C396 384 400 368 406 356" fill="none" stroke="#a96d43" strokeWidth="5" strokeLinecap="round"/>
        <path d="M452 404C452 378 464 362 480 362C496 362 508 378 508 404Z" fill="#3a2418"/>
        <g className="mbs-flames">
          <path d="M466 404C460 392 468 380 472 372C474 384 482 384 480 394C486 388 488 380 486 372C496 384 498 398 492 404Z" fill="#ff8c1a"/>
          <path d="M472 404C470 396 474 390 478 384C480 392 486 394 486 404Z" fill="#ffd166"/>
        </g>
        {/* kafgir: the long paddle that never stops stirring */}
        <g className="mbs-stir">
          <path d="M478 300L372 176" stroke="#b07a48" strokeWidth="8" strokeLinecap="round"/>
          <path d="M466 290L380 188" stroke="#d29a63" strokeWidth="2.4" strokeLinecap="round" opacity=".7"/>
        </g>
        <g className="mbs-steam" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round">
          <path d="M448 286C440 268 460 254 452 236C446 222 458 212 452 198" style={delay('0s')}/>
          <path d="M492 284C484 266 504 252 496 234C490 220 502 210 496 196" style={delay('-1.6s')}/>
          <path d="M520 288C512 272 530 260 524 244" style={delay('-3s')}/>
        </g>
      </svg>
    </>
  );
}

/** Yoz: an ishkom grapevine, a turquoise peshtoq, melons and a paxta choynak. */
export function SummerScene() {
  return (
    <>
      <svg className="mbs-corner" viewBox="0 0 360 260" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" focusable="false">
        <defs>
          <path id="mbsSuLeaf" d="M0 0C-6-6-20-6-24-16C-16-16-14-24-20-30C-10-30-6-36-4-44C2-36 8-34 16-36C14-28 20-22 28-22C22-14 20-6 12-4C8-2 4-1 0 0Z" fill="#52b788"/>
          <g id="mbsSuGrapes">
            <path d="M0-4C2-12 6-16 10-18" fill="none" stroke="#6b4630" strokeWidth="2.4" strokeLinecap="round"/>
            <g fill="#7b4ab3">
              <circle cx="-8" cy="4" r="6.5"/><circle cx="4" cy="4" r="6.5"/><circle cx="-2" cy="14" r="6.5"/><circle cx="10" cy="13" r="6"/>
              <circle cx="-12" cy="14" r="6"/><circle cx="-6" cy="24" r="6"/><circle cx="6" cy="23" r="6"/><circle cx="0" cy="33" r="5.6"/>
            </g>
            <g fill="#b48ae0" opacity=".7"><circle cx="-10" cy="2" r="2"/><circle cx="2" cy="2" r="2"/><circle cx="-4" cy="12" r="2"/><circle cx="4" cy="21" r="1.8"/></g>
          </g>
        </defs>
        <g className="mbs-sway-branch">
          <path d="M362 18C320 28 290 20 250 34C210 48 170 40 130 56C100 68 80 64 54 76" fill="none" stroke="#7a5233" strokeWidth="7" strokeLinecap="round"/>
          <path d="M120 60C112 50 116 40 126 40C134 42 132 52 124 52" fill="none" stroke="#7a5233" strokeWidth="2" strokeLinecap="round"/>
          <path d="M232 40C224 30 230 22 238 24" fill="none" stroke="#7a5233" strokeWidth="2" strokeLinecap="round"/>
          <use href="#mbsSuLeaf" transform="translate(330 30) rotate(160) scale(1.1)"/>
          <use href="#mbsSuLeaf" transform="translate(280 26) rotate(-10)"/>
          <use href="#mbsSuLeaf" transform="translate(212 50) rotate(170) scale(1.15)"/>
          <use href="#mbsSuLeaf" transform="translate(160 44) rotate(-20) scale(.9)"/>
          <use href="#mbsSuLeaf" transform="translate(96 70) rotate(150) scale(.95)"/>
          <use href="#mbsSuLeaf" transform="translate(64 76) rotate(-30) scale(.8)"/>
          <g className="mbs-swing" style={delay('0s')}><use href="#mbsSuGrapes" transform="translate(250 50)"/></g>
          <g className="mbs-swing" style={delay('-1.8s')}><use href="#mbsSuGrapes" transform="translate(140 66) scale(.85)"/></g>
          <g className="mbs-swing" style={delay('-3.2s')}><use href="#mbsSuGrapes" transform="translate(312 36) scale(.7)"/></g>
        </g>
      </svg>
      <svg className="mbs-scene" viewBox="0 0 640 420" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="mbsSuTile" width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" fill="#4fb3bf"/>
            <path d="M11 3L13.5 8.5L19 11L13.5 13.5L11 19L8.5 13.5L3 11L8.5 8.5Z" fill="#1f6f8b"/>
            <circle cx="11" cy="11" r="2.2" fill="#f2e8cf"/>
          </pattern>
          <g id="mbsSuPaxta" fill="#1d4e89"><circle r="3.2"/><circle cx="-4" cy="-4" r="2.6"/><circle cx="4" cy="-4" r="2.6"/><circle cx="-4" cy="4" r="2.6"/><circle cx="4" cy="4" r="2.6"/></g>
        </defs>
        {/* sky: sun by day, moon and stars by night */}
        <g className="mbs-day">
          <g className="mbs-spin" style={{ transformOrigin: '150px 116px' }}>
            <g stroke="#ffd166" strokeWidth="4" strokeLinecap="round" opacity=".8">
              <path d="M150 62V48"/><path d="M150 184V170"/><path d="M96 116H82"/><path d="M218 116H204"/>
              <path d="M112 78L102 68"/><path d="M198 164L188 154"/><path d="M188 78L198 68"/><path d="M112 154L102 164"/>
            </g>
          </g>
          <circle cx="150" cy="116" r="38" fill="#ffd166"/>
          <circle cx="150" cy="116" r="28" fill="#ffe29a"/>
        </g>
        <g className="mbs-night">
          <path d="M168 84A40 40 0 1 0 186 150A32 32 0 1 1 168 84Z" fill="#fff3bf"/>
          <g fill="#fff8dc" className="mbs-twinkle"><circle cx="70" cy="70" r="2" style={delay('0s')}/><circle cx="240" cy="54" r="1.6" style={delay('-1s')}/><circle cx="300" cy="120" r="2.2" style={delay('-2s')}/><circle cx="40" cy="160" r="1.5" style={delay('-.5s')}/><circle cx="360" cy="70" r="1.8" style={delay('-1.5s')}/></g>
        </g>
        {/* peshtoq: tiled portal */}
        <g opacity=".9">
          <path d="M404 420V128H632V420Z" fill="url(#mbsSuTile)"/>
          <path d="M404 128H632V140H404Z" fill="#1f6f8b"/>
          <path d="M444 420V262C444 208 478 178 518 160C558 178 592 208 592 262V420Z" fill="#e8f4f1"/>
          <path d="M444 420V262C444 208 478 178 518 160C558 178 592 208 592 262V420" fill="none" stroke="#f2e8cf" strokeWidth="5"/>
          <path d="M462 420V270C462 228 488 204 518 190C548 204 574 228 574 270V420Z" fill="#cfe9e4"/>
        </g>
        <path d="M0 420V382C200 366 420 374 640 362V420Z" fill="#f3dfb5"/>
        <path d="M0 420V400C220 390 430 396 640 388V420Z" fill="#ead0a0"/>
        {/* lagan with qovun, tarvuz and uzum */}
        <ellipse cx="300" cy="388" rx="128" ry="22" fill="#f8f4ec" stroke="#2b6cb0" strokeWidth="3"/>
        <ellipse cx="300" cy="388" rx="100" ry="15" fill="none" stroke="#2b6cb0" strokeWidth="2" strokeDasharray="6 6"/>
        <ellipse cx="352" cy="364" rx="50" ry="27" fill="#f4c95d"/>
        <g fill="none" stroke="#d4a537" strokeWidth="2"><path d="M312 356C332 344 372 344 394 358"/><path d="M306 368C330 360 374 360 400 372"/><path d="M330 340C326 356 330 374 338 388"/><path d="M362 338C366 356 366 374 360 390"/></g>
        <path d="M398 360C406 354 410 350 414 346" stroke="#6b4630" strokeWidth="3" strokeLinecap="round"/>
        <path d="M206 386A44 44 0 0 1 294 386Z" fill="#ef476f"/>
        <path d="M206 386A44 44 0 0 1 294 386" fill="none" stroke="#2d6a4f" strokeWidth="6"/>
        <path d="M212 386A38 38 0 0 1 288 386" fill="none" stroke="#b7e4c7" strokeWidth="3"/>
        <g fill="#2b2d42"><ellipse cx="236" cy="372" rx="2" ry="3"/><ellipse cx="252" cy="364" rx="2" ry="3"/><ellipse cx="268" cy="372" rx="2" ry="3"/><ellipse cx="250" cy="378" rx="2" ry="3"/></g>
        <g fill="#7b4ab3"><circle cx="186" cy="380" r="7"/><circle cx="174" cy="384" r="7"/><circle cx="180" cy="372" r="7"/><circle cx="168" cy="374" r="6.5"/></g>
        {/* choynak and piyolas in the paxta pattern */}
        <path d="M452 392C440 366 452 338 482 334C512 338 524 366 512 392Z" fill="#fdfdfd" stroke="#1d4e89" strokeWidth="2.4"/>
        <path d="M452 368C440 364 432 352 426 340L432 336C440 348 446 354 456 356" fill="#fdfdfd" stroke="#1d4e89" strokeWidth="2.4" strokeLinejoin="round"/>
        <path d="M512 350C534 350 534 380 512 382" fill="none" stroke="#1d4e89" strokeWidth="5" strokeLinecap="round"/>
        <ellipse cx="482" cy="334" rx="20" ry="5.5" fill="#fdfdfd" stroke="#1d4e89" strokeWidth="2.4"/>
        <circle cx="482" cy="326" r="4.5" fill="#1d4e89"/>
        <use href="#mbsSuPaxta" transform="translate(470 360)"/><use href="#mbsSuPaxta" transform="translate(494 372) scale(.85)"/><use href="#mbsSuPaxta" transform="translate(486 350) scale(.7)"/>
        <g className="mbs-steam" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round"><path d="M426 332C420 320 432 312 426 300" style={delay('-.8s')}/></g>
        <path d="M536 380Q552 404 568 380Z" fill="#fdfdfd" stroke="#1d4e89" strokeWidth="2"/><use href="#mbsSuPaxta" transform="translate(552 388) scale(.6)"/>
        <path d="M578 384Q594 408 610 384Z" fill="#fdfdfd" stroke="#1d4e89" strokeWidth="2"/><use href="#mbsSuPaxta" transform="translate(594 392) scale(.6)"/>
      </svg>
    </>
  );
}

/** Kuz: a pomegranate branch, cotton in a ko‘za, golden chinar leaves. */
export function AutumnScene() {
  return (
    <>
      <svg className="mbs-corner" viewBox="0 0 360 260" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" focusable="false">
        <defs>
          <path id="mbsAuLeaf" d="M0 0C8-5 20-5 28 0C20 5 8 5 0 0Z"/>
          <g id="mbsAuAnor">
            <circle r="20" fill="#c1121f"/>
            <path d="M-14-6C-10-14-2-18 6-16" fill="none" stroke="#e5484d" strokeWidth="4" strokeLinecap="round" opacity=".8"/>
            <path d="M-6-18L-8-26L-3-22L0-28L3-22L8-26L6-18Z" fill="#8f0d16"/>
          </g>
        </defs>
        <g className="mbs-sway-branch">
          <path d="M362 26C320 34 280 30 240 46C200 62 160 66 112 84C86 94 66 96 44 104" fill="none" stroke="#6b4630" strokeWidth="8" strokeLinecap="round"/>
          <path d="M196 62C190 82 194 100 188 118" fill="none" stroke="#6b4630" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M286 36C282 58 286 76 280 96" fill="none" stroke="#6b4630" strokeWidth="3.5" strokeLinecap="round"/>
          <g>
            <use href="#mbsAuLeaf" fill="#2d6a4f" transform="translate(330 28) rotate(170)"/>
            <use href="#mbsAuLeaf" fill="#e9c46a" transform="translate(300 34) rotate(-30)"/>
            <use href="#mbsAuLeaf" fill="#40916c" transform="translate(252 44) rotate(190)"/>
            <use href="#mbsAuLeaf" fill="#f4a261" transform="translate(222 52) rotate(-20) scale(.9)"/>
            <use href="#mbsAuLeaf" fill="#2d6a4f" transform="translate(160 68) rotate(200)"/>
            <use href="#mbsAuLeaf" fill="#e9c46a" transform="translate(132 78) rotate(-35) scale(.9)"/>
            <use href="#mbsAuLeaf" fill="#e76f51" transform="translate(84 92) rotate(190) scale(.9)"/>
            <use href="#mbsAuLeaf" fill="#40916c" transform="translate(60 98) rotate(-25) scale(.8)"/>
          </g>
          <g className="mbs-swing" style={delay('0s')}><use href="#mbsAuAnor" transform="translate(188 138)"/></g>
          <g className="mbs-swing" style={delay('-2s')}><use href="#mbsAuAnor" transform="translate(280 114) scale(.85)"/></g>
        </g>
      </svg>
      <svg className="mbs-scene" viewBox="0 0 640 420" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
        <defs>
          <g id="mbsAuBoll">
            <path d="M0 6L-9 12L-6 2L-12-4L-2-3L0-12L2-3L12-4L6 2L9 12Z" fill="#6b4226"/>
            <g fill="#fbfbf7"><circle cx="-6" cy="-6" r="8"/><circle cx="6" cy="-6" r="8"/><circle cx="-6" cy="5" r="8"/><circle cx="6" cy="5" r="8"/><circle cx="0" cy="-1" r="8.5"/></g>
            <g fill="#e9e4d8"><circle cx="-8" cy="7" r="3"/><circle cx="8" cy="-8" r="3"/></g>
          </g>
          <path id="mbsAuChinar" transform="scale(.3) translate(-50 -50)" d="M50 94L48 75C40 79 28 81 17 78L24 68C13 64 5 56 3 47L16 47C11 39 11 29 15 20C24 27 30 31 34 34L31 17C38 21 43 13 50 3C57 13 62 21 69 17L66 34C70 31 76 27 85 20C89 29 89 39 84 47L97 47C95 56 87 64 76 68L83 78C72 81 60 79 52 75L50 94Z"/>
          <g id="mbsAuAnorBig">
            <circle r="23" fill="#c1121f"/>
            <path d="M-16-6C-12-15-3-20 6-18" fill="none" stroke="#e5484d" strokeWidth="4.5" strokeLinecap="round" opacity=".8"/>
            <path d="M-7-21L-9-30L-3-25L0-32L3-25L9-30L7-21Z" fill="#8f0d16"/>
          </g>
        </defs>
        <path d="M0 420V380C180 358 400 374 640 350V420Z" fill="#ecc89c"/>
        <path d="M0 420V398C200 386 430 394 640 382V420Z" fill="#d9a86c"/>
        <g>
          <use href="#mbsAuChinar" fill="#e76f51" transform="translate(70 396) rotate(30) scale(.9)"/>
          <use href="#mbsAuChinar" fill="#e9c46a" transform="translate(120 404) rotate(-40) scale(.8)"/>
          <use href="#mbsAuChinar" fill="#bc4749" transform="translate(560 404) rotate(15) scale(.9)"/>
          <use href="#mbsAuChinar" fill="#f4a261" transform="translate(610 396) rotate(-25) scale(.75)"/>
          <use href="#mbsAuChinar" fill="#e9c46a" transform="translate(380 404) rotate(60) scale(.7)"/>
        </g>
        {/* savat with anor; one is broken open */}
        <use href="#mbsAuAnorBig" transform="translate(236 344)"/>
        <use href="#mbsAuAnorBig" transform="translate(280 336) scale(1.05)"/>
        <use href="#mbsAuAnorBig" transform="translate(320 346) scale(.95)"/>
        <path d="M206 356H350L336 400H220Z" fill="#b08968"/>
        <g fill="none" stroke="#7f5539" strokeWidth="2.4"><path d="M210 368H346"/><path d="M214 380H342"/><path d="M217 391H339"/><path d="M234 356L240 400"/><path d="M262 356L264 400"/><path d="M290 356L290 400"/><path d="M318 356L314 400"/></g>
        <path d="M202 356H354" stroke="#7f5539" strokeWidth="6" strokeLinecap="round"/>
        <g transform="translate(176 392)">
          <path d="M-22 0A22 22 0 0 1 22 0Z" fill="#c1121f"/>
          <path d="M-17 0A17 17 0 0 1 17 0Z" fill="#ffe3e3"/>
          <g fill="#e5383b"><circle cx="-10" cy="-4" r="3"/><circle cx="-4" cy="-9" r="3"/><circle cx="3" cy="-11" r="3"/><circle cx="10" cy="-6" r="3"/><circle cx="0" cy="-3" r="3"/><circle cx="7" cy="-1" r="2.6"/><circle cx="-6" cy="-1" r="2.6"/></g>
        </g>
        {/* ko'za with paxta branches */}
        <g className="mbs-sway" style={delay('-1s')}>
          <path d="M488 300C482 250 470 220 452 196" fill="none" stroke="#6b4226" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M496 300C498 246 506 208 520 176" fill="none" stroke="#6b4226" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M504 300C516 260 536 236 560 220" fill="none" stroke="#6b4226" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M492 262C480 256 474 248 470 238" fill="none" stroke="#6b4226" strokeWidth="2.4" strokeLinecap="round"/>
          <use href="#mbsAuBoll" transform="translate(452 192)"/>
          <use href="#mbsAuBoll" transform="translate(520 172) scale(1.1)"/>
          <use href="#mbsAuBoll" transform="translate(562 216) scale(.95)"/>
          <use href="#mbsAuBoll" transform="translate(468 234) scale(.75)"/>
          <use href="#mbsAuBoll" transform="translate(530 250) scale(.7)"/>
        </g>
        <path d="M470 300H530C528 310 524 316 520 320C552 336 562 366 548 392C540 404 460 404 452 392C438 366 448 336 480 320C476 316 472 310 470 300Z" fill="#c8553d"/>
        <path d="M466 296H534" stroke="#a63d2a" strokeWidth="7" strokeLinecap="round"/>
        <g fill="none" stroke="#f2cc8f" strokeWidth="3"><path d="M452 356C478 348 522 348 550 356"/><path d="M450 372C478 364 524 364 552 372"/></g>
        <path d="M462 344L472 354L482 344L492 354L502 344L512 354L522 344L532 354L542 344" fill="none" stroke="#7a2e1f" strokeWidth="2"/>
      </svg>
    </>
  );
}

/** Qish: snow on a blue dome and minaret, a glowing tandir, fresh non. */
export function WinterScene() {
  return (
    <>
      <svg className="mbs-corner" viewBox="0 0 360 260" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" focusable="false">
        <g className="mbs-sway-branch">
          <path d="M362 24C320 34 280 30 238 46C198 62 156 64 110 82C84 92 66 94 44 102" fill="none" stroke="#5c4033" strokeWidth="8" strokeLinecap="round"/>
          <path d="M206 58C200 80 204 98 196 118" fill="none" stroke="#5c4033" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M292 34C286 52 290 68 284 86" fill="none" stroke="#5c4033" strokeWidth="3.5" strokeLinecap="round"/>
          <g fill="#ffffff">
            <path d="M352 20C336 14 314 18 300 26C318 28 336 26 352 20Z"/>
            <path d="M276 30C258 26 238 34 226 44C244 44 262 40 276 30Z"/>
            <path d="M190 58C170 56 148 64 136 74C156 74 176 70 190 58Z"/>
            <path d="M108 78C92 78 72 84 60 92C78 94 96 90 108 78Z"/>
            <ellipse cx="196" cy="116" rx="7" ry="4"/><ellipse cx="284" cy="84" rx="7" ry="4"/>
          </g>
          <g fill="#bfe3ff" opacity=".9"><path d="M248 46L251 64L254 45Z"/><path d="M168 70L170 84L173 69Z"/><path d="M320 30L322 42L325 29Z"/><path d="M96 88L98 100L100 87Z"/></g>
          <g fill="#d62839"><circle cx="196" cy="126" r="5"/><circle cx="204" cy="130" r="4.5"/><circle cx="188" cy="132" r="4.2"/><circle cx="284" cy="94" r="4.6"/><circle cx="292" cy="98" r="4"/></g>
          <g fill="#ff8fa3" opacity=".7"><circle cx="194" cy="124" r="1.5"/><circle cx="282" cy="92" r="1.4"/></g>
        </g>
      </svg>
      <svg className="mbs-scene" viewBox="0 0 640 420" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="mbsWiGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffb347" stopOpacity=".8"/><stop offset="1" stopColor="#ff7a18" stopOpacity="0"/></radialGradient>
          <linearGradient id="mbsWiDome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2f78b7"/><stop offset=".5" stopColor="#4aa3df"/><stop offset="1" stopColor="#2a6aa3"/></linearGradient>
          <pattern id="mbsWiTile" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#2f78b7"/><path d="M8 2L10 6L14 8L10 10L8 14L6 10L2 8L6 6Z" fill="#9ed2f5"/></pattern>
        </defs>
        <g className="mbs-night">
          <path d="M150 70A34 34 0 1 0 168 126A27 27 0 1 1 150 70Z" fill="#fff3bf"/>
          <g fill="#fff8dc" className="mbs-twinkle"><circle cx="60" cy="60" r="2" style={delay('0s')}/><circle cx="230" cy="40" r="1.6" style={delay('-1.2s')}/><circle cx="300" cy="110" r="2" style={delay('-2s')}/><circle cx="40" cy="150" r="1.5" style={delay('-.6s')}/><circle cx="380" cy="60" r="1.8" style={delay('-1.6s')}/></g>
        </g>
        <g className="mbs-day"><circle cx="150" cy="104" r="34" fill="#fff4d6"/><circle cx="150" cy="104" r="48" fill="#fff4d6" opacity=".35"/></g>
        {/* madrasa: fluted blue dome and minaret */}
        <path d="M424 420V132L430 112H446L452 132V420Z" fill="#e8dcc8"/>
        <path d="M424 170H452V184H424Z" fill="url(#mbsWiTile)"/><path d="M424 250H452V264H424Z" fill="url(#mbsWiTile)"/>
        <path d="M420 112H456L452 96H424Z" fill="#d8c9b0"/>
        <path d="M422 98C430 88 446 88 454 98Z" fill="#ffffff"/>
        <path d="M470 420V246H620V420Z" fill="#e8dcc8"/>
        <path d="M482 252V220H608V252Z" fill="url(#mbsWiTile)"/>
        <path d="M474 224C474 156 506 118 545 104C584 118 616 156 616 224Z" fill="url(#mbsWiDome)"/>
        <g fill="none" stroke="#24608f" strokeWidth="2.6" opacity=".7"><path d="M496 222C494 176 512 140 545 106"/><path d="M520 222C518 174 528 136 545 106"/><path d="M570 222C572 174 562 136 545 106"/><path d="M594 222C596 176 578 140 545 106"/></g>
        <path d="M510 128C524 112 566 112 580 128C566 136 556 128 545 136C534 128 524 136 510 128Z" fill="#ffffff"/>
        <path d="M545 104V84" stroke="#c9a227" strokeWidth="3"/><circle cx="545" cy="82" r="4" fill="#c9a227"/>
        <path d="M470 246H620" stroke="#ffffff" strokeWidth="7" strokeLinecap="round"/>
        <path d="M520 420V318C520 296 532 284 545 278C558 284 570 296 570 318V420Z" fill="#2a5d87"/>
        <path d="M520 318C520 296 532 284 545 278C558 284 570 296 570 318" fill="none" stroke="#9ed2f5" strokeWidth="3"/>
        <g className="mbs-window-glow" fill="#ffd27a"><path d="M490 300H504V322H490Z"/><path d="M586 300H600V322H586Z"/></g>
        {/* snow */}
        <path d="M0 420V376C150 356 320 380 470 366C540 360 600 364 640 358V420Z" fill="#f2f7fc"/>
        <path d="M0 420V398C180 388 380 400 640 384V420Z" fill="#dce8f4"/>
        {/* tandir with steam, non on a lagan */}
        <ellipse cx="256" cy="330" rx="74" ry="56" fill="url(#mbsWiGlow)" className="mbs-flicker-glow"/>
        <path d="M194 392C194 334 222 304 256 304C290 304 318 334 318 392Z" fill="#c98b5e"/>
        <path d="M206 378C208 344 224 322 244 314" fill="none" stroke="#e0a77b" strokeWidth="5" strokeLinecap="round" opacity=".8"/>
        <path d="M220 316C236 300 276 300 292 316C280 322 268 316 256 322C244 316 232 322 220 316Z" fill="#ffffff"/>
        <ellipse cx="256" cy="330" rx="20" ry="9" fill="#ff9f1c" className="mbs-flicker"/>
        <ellipse cx="256" cy="330" rx="12" ry="5" fill="#ffd166"/>
        <g className="mbs-steam" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round"><path d="M250 316C242 298 262 286 254 268C248 256 258 246 252 234" style={delay('0s')}/><path d="M266 316C260 302 276 292 270 278" style={delay('-1.7s')}/></g>
        <ellipse cx="112" cy="398" rx="58" ry="12" fill="#f8f4ec" stroke="#2b6cb0" strokeWidth="2.4"/>
        <ellipse cx="112" cy="384" rx="44" ry="15" fill="#c98a3f"/>
        <ellipse cx="112" cy="382" rx="28" ry="9" fill="#e4b46c"/>
        <g fill="#9a6327"><circle cx="112" cy="382" r="1.6"/><circle cx="102" cy="381" r="1.4"/><circle cx="122" cy="381" r="1.4"/><circle cx="107" cy="386" r="1.4"/><circle cx="117" cy="386" r="1.4"/><circle cx="107" cy="378" r="1.4"/><circle cx="117" cy="378" r="1.4"/><circle cx="96" cy="384" r="1.2"/><circle cx="128" cy="384" r="1.2"/></g>
      </svg>
    </>
  );
}

export const SCENES: Record<Season, () => React.JSX.Element> = { spring: SpringScene, summer: SummerScene, autumn: AutumnScene, winter: WinterScene };
