const quizScenes = Object.freeze({
  underwater: 'Су асты әлемі',
  cave: 'Тау үңгірі',
  space: 'Ғарыш',
  forest: 'Орман',
  steppe: 'Қазақ даласы',
  cyberpunk: 'Киберпанк',
  volcano: 'Жанартау',
  arctic: 'Арктика',
  retro: 'Ретро аркада',
  magic: 'Сиқыр әлемі'
});

// Scenes share a responsive stage; each object animates in its own coordinates.
function quizSceneMarkup(key) {
  const stage = quizSceneMarkup.sequence = (quizSceneMarkup.sequence || 0) + 1;
  const id = name => 'scene-' + stage + '-' + name;
  const repeat = (count, draw) => Array.from({length: count}, (_, i) => draw(i)).join('');
  const path = (d, fill, extra = '') => '<path d="' + d + '" fill="' + fill + '" ' + extra + '/>';
  const circle = (x,y,r,fill) => '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'"/>';
  const group = (content, transform) => '<g transform="'+transform+'">'+content+'</g>';
  const motion = (shape, values, seconds, delay = 0, type = 'translate') =>
    '<g><animateTransform attributeName="transform" type="'+type+'" values="'+values+'" dur="'+seconds+'s" begin="-'+delay+'s" repeatCount="indefinite"/>'+shape+'</g>';
  const stars = repeat(35,i=>circle(i*113%400,i*37%137,0.6+i%3*.32,'#d6ecff'));
  const hills = (color, level, amplitude) => path('M0 200 L0 '+level+' '+repeat(12,i=>'L'+((i+1)*37)+' '+(level-amplitude*Math.sin(i*2.34)**2)+' ')+'V200Z',color);
  let sky, world;
  switch(key) {
    case 'cave': {
      sky=['#130d2e','#236588','#132941'];
      const crystal = path('M-9 0 -11 -25 -3 -41 6 -24 7 0Z','#66ebe1')+path('M-3 -41 0 -24 7 0 6 -24Z','#1680a2');
      world=hills('#183840',186,16)+repeat(16,i=>path('M'+(i*28-10)+' 0 l10 '+(15+i*19%45)+' 13 -65Z','#171726'))+
        repeat(9,i=>group(crystal,'translate('+(i*58%409)+' '+(163+i%3*11)+') scale('+(.45+i%4*.23)+')'))+
        repeat(8,i=>motion(circle(i*57%400,0,1.7,'#c4f8ff'),'0 -30;0 200',2.7+i%3,i*.83))+
        repeat(4,i=>group(motion('<ellipse rx="19" ry="2" fill="none" stroke="#70c5d1"/>','0.06 0.1;1.3 1;0.06 0.1',3,i,'scale'),'translate('+(40+i*97)+' 188)'));break;
    }
    case 'space': case 'magic': {
      const magic=key==='magic';
      sky=magic?['#170c38','#582663','#141124']:['#030a28','#22224c','#06091a'];
      const planet='<circle r="32" fill="url(#'+id('orb')+')"/>'+path('M-31 -8 Q-3 7 31 -2 Q5 13 -29 0Z','#dfae72');
      world=stars+ (magic?
        group(path('M-54 0 Q-28 -10 0 3 Q27 -13 54 -3 L48 13 Q20 6 0 16 Q-24 6 -53 13Z','#e8c891'),'translate(196 147)')+
        repeat(20,i=>group(motion(circle(0,0,1+i%3,'#ffe39d'),'0 0;12 -55;-7 -98',3+i%3,i*.47),'translate('+(154+i*17%85)+' 140)')):
        group(motion(planet+'<ellipse rx="54" ry="10" fill="none" stroke="#e4c49e" stroke-width="4" transform="rotate(-19)"/>','-6;6;-6',18,2,'rotate'),'translate(251 83)')+
        motion(path('M0 0 l-28 -12 25 8Z','#aadaff'),'0 -50;400 135;500 220',7,1));break;
    }
    case 'forest': case 'steppe': {
      const forest=key==='forest';
      sky=forest?['#124343','#9bb896','#d7cf92']:['#655c94','#ffbf88','#e4b668'];
      world=circle(300,61,21,'#ffdd98')+hills(forest?'#558475':'#9c806e',146,39)+hills(forest?'#285b53':'#b89a4a',164,24);
      if(forest)world+=repeat(21,i=>group(path('M0 0 -13 27 -7 26 -19 42 -9 40 -24 56 24 56 9 40 19 42 7 26 13 27Z',i%2?'#214f42':'#37715b'),'translate('+(i*73%420-10)+' '+(77+i%5*9)+') scale('+(0.8+i%3*.27)+')'));
      else world+=group(path('M-27 0 Q-18 -16 0 -18 Q18 -16 27 0 V14 H-27Z','#f0dfb0')+path('M-4 2 H4 V14 H-4Z','#81553e'),'translate(284 140)');
      world+=hills(forest?'#153c37':'#9a762e',178,10)+repeat(30,i=>group(motion(path('M0 0 Q-4 -11 2 -22 Q6 -9 0 0Z',forest?'#608b53':'#e2bd67'),'-12;14;-12',3+i%3,i*.27,'rotate'),'translate('+(i*61%409)+' '+(177+i%5*5)+')'));
      if(forest)world+=repeat(8,i=>motion(circle(i*59%400,98+i%4*14,1.5,'#ffeb99'),'0 0;8 -8;0 0',3+i%3,i*.54));
      break;
    }
    case 'volcano':{
      sky=['#2b2039','#aa574c','#ef9858'];
      world=hills('#6e4a57',160,33)+path('M-10 200 172 70 192 72 209 67 402 200Z','#422d36')+
        path('M175 70 Q188 89 163 107 T134 139 L82 188 131 150 148 132 173 117 186 94 189 72Z','#ff933a')+
        repeat(22,i=>motion(circle(0,0,1+i%3*.65,'#ffbd58'),'185 73;'+(164+i*13%52)+' '+(16+i*7%32)+';'+(118+i*29%146)+' 115',1.8+i%5*.3,i*.51));break;
    }
    case 'arctic':{
      sky=['#081a39','#15556a','#8bc3cf'];
      world=stars+repeat(5,i=>motion(path('M-50 48 Q40 -5 140 47 T305 42 T454 4 L454 21 Q365 91 286 62 T131 63 T-50 76Z',i%2?'#61e6ad':'#8adedb','opacity=".17"'),'0 0;18 '+(i*4+3)+';0 0',6+i,i))+
        hills('#bccfdf',154,63)+hills('#678eaa',170,46)+hills('#d9eef4',191,13);break;
    }
    case 'retro':case 'cyberpunk':{
      const retro=key==='retro';sky=['#100d31','#4d245d','#111b39'];
      world=circle(290,69,29,retro?'#feab80':'#9576bb')+repeat(20,i=>{const y=65+i*43%65;
        return path('M'+i*21+' 165 V'+y+' h19 V165Z',i%2?'#14213e':'#201b40')+repeat(5,j=>circle(i*21+5+j%2*7,y+7+j*6,1.3,i%3?'#76d8e9':'#ff88c9'))})+
        path('M0 149H400V200H0Z','#171632');
      if(retro)world+=repeat(14,i=>path('M200 142 L'+(i*74-280)+' 211','none','stroke="#794bb1"'))+repeat(6,i=>motion(path('M0 0H400','none','stroke="#fa70d2"'),'0 150;0 204',2,i*.34));
      else world+=repeat(12,i=>motion(path('M0 0h13','none','stroke="'+(i%2?'#72f5ff':'#fc77bb')+'" stroke-width="2"'),'420 '+(105+i*5)+';-23 '+(105+i*5),3+i%3,i*.72));break;
    }
    default:{
      sky=['#48bed0','#116487','#062e50'];
      const fish=path('M-13 0 Q-2 -10 9 -2 L16 -7 14 6 8 2 Q-3 10 -13 0Z','#9adedf')+circle(-8,-1,1,'#143e5a');
      world=repeat(5,i=>path('M'+(i*88)+' 0 l-55 151 96 -151Z','#c2fff1','opacity=".10"'))+hills('#10546a',180,24)+
        repeat(11,i=>motion(group(fish,'scale('+(.45+i%3*.18)+')'),'420 '+(61+i*19%80)+';-23 '+(65+i*19%80),10+i%5,i*2.73))+
        repeat(14,i=>motion('<circle cx="'+(i*69%400)+'" r="'+(1+i%3)+'" stroke="#8be4ed" fill="none" opacity=".55"/>','0 210;7 -10',4+i%5,i*1.31))+hills('#0a4352',200,17);
    }
  }
  return '<svg class="quiz-motion" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="'+id('sky')+'" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="'+sky[0]+'"/><stop offset=".6" stop-color="'+sky[1]+'"/><stop offset="1" stop-color="'+sky[2]+'"/></linearGradient><radialGradient id="'+id('orb')+'" cx=".3" cy=".24" r=".85"><stop stop-color="#ffdfaa"/><stop offset=".7" stop-color="#ba7f69"/><stop offset="1" stop-color="#51445f"/></radialGradient></defs><rect width="400" height="200" fill="url(#'+id('sky')+')"/>'+world+'</svg>';
}
