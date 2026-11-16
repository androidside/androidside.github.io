function fit(){document.getElementById('slide').style.transform=`scale(${Math.min(innerWidth/1280,innerHeight/720)})`;}
addEventListener('resize',fit);fit();addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&parent!==window){e.preventDefault();parent.postMessage({type:'recetas-slide-key',key:e.key},location.origin);}});
