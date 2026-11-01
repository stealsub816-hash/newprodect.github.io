(() => {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlayCanvas');
  const octx = overlay.getContext('2d');
  const $ = id => document.getElementById(id);
  let layers = [], activeLayer = 0, tool = 'move', color = '#287bff';
  let drawing = false, start = null, last = null, cropRect = null;
  let zoom = 1, undoStack = [], redoStack = [];
  let baseImage = null, fileName = 'Без названия';
  let adjustments = {brightness:100, contrast:100, saturation:100};
  let filter = 'none';

  function makeLayer(name='Слой') {
    const c = document.createElement('canvas'); c.width=canvas.width; c.height=canvas.height;
    return {name, canvas:c, visible:true};
  }
  function init(w=1200,h=800) {
    canvas.width=overlay.width=w; canvas.height=overlay.height=h;
    layers=[makeLayer('Слой 1')]; activeLayer=0; undoStack=[]; redoStack=[];
    baseImage=null; fileName='Без названия'; cropRect=null;
    $('documentName').textContent=fileName; $('dimensions').textContent=` · ${w} × ${h}`;
    renderLayers(); render(); fitCanvas(); updateStatus('Создан новый холст');
  }
  function activeCtx(){return layers[activeLayer].canvas.getContext('2d')}
  function snapshot(){
    undoStack.push({w:canvas.width,h:canvas.height,layers:layers.map(l=>({name:l.name,visible:l.visible,data:l.canvas.toDataURL()}))});
    if(undoStack.length>30)undoStack.shift(); redoStack=[];
  }
  function restore(state){
    canvas.width=overlay.width=state.w;canvas.height=overlay.height=state.h;
    layers=state.layers.map(l=>{let c=document.createElement('canvas');c.width=state.w;c.height=state.h;let x=c.getContext('2d');let im=new Image();im.onload=()=>x.drawImage(im,0,0);im.src=l.data;return {name:l.name,visible:l.visible,canvas:c}});
    activeLayer=Math.min(activeLayer,layers.length-1);renderLayers();render();fitCanvas();
  }
  function undo(){if(!undoStack.length)return;redoStack.push(capture());restore(undoStack.pop());updateStatus('Отменено')}
  function capture(){return {w:canvas.width,h:canvas.height,layers:layers.map(l=>({name:l.name,visible:l.visible,data:l.canvas.toDataURL()}))}}
  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const l of layers)if(l.visible)ctx.drawImage(l.canvas,0,0);
    canvas.style.filter=`brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) ${filter==='grayscale'?'grayscale(1)':filter==='sepia'?'sepia(1)':filter==='blur'?'blur(2px)':filter==='invert'?'invert(1)':''}`;
    $('dimensions').textContent=` · ${canvas.width} × ${canvas.height}`;
  }
  function fitCanvas(){
    const area=$('canvasArea');const maxW=area.clientWidth-50,maxH=area.clientHeight-50;
    zoom=Math.min(maxW/canvas.width,maxH/canvas.height,1);zoom=Math.max(.05,zoom);
    const w=Math.round(canvas.width*zoom),h=Math.round(canvas.height*zoom);
    canvas.style.width=overlay.style.width=w+'px';canvas.style.height=overlay.style.height=h+'px';
    overlay.width=canvas.width;overlay.height=canvas.height;overlay.style.width=w+'px';overlay.style.height=h+'px';
    $('zoomLabel').textContent=Math.round(zoom*100)+'%';
  }
  function setZoom(v){zoom=Math.max(.1,Math.min(3,v));let w=Math.round(canvas.width*zoom),h=Math.round(canvas.height*zoom);canvas.style.width=overlay.style.width=w+'px';canvas.style.height=overlay.style.height=h+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%'}
  function renderLayers(){
    const box=$('layersList');box.innerHTML='';
    layers.forEach((l,i)=>{const row=document.createElement('div');row.className='layer-item'+(i===activeLayer?' selected':'');
      row.innerHTML=`<span class="layer-thumb"></span><span class="layer-name"></span><button title="Видимость">${l.visible?'◉':'○'}</button>`;
      row.querySelector('.layer-name').textContent=l.name;
      row.addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){l.visible=!l.visible;renderLayers();render();return}activeLayer=i;renderLayers()});
      box.appendChild(row);
    });
  }
  function updateStatus(s){$('statusText').textContent=s}
  function pos(e){const r=overlay.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
  function setTool(t){tool=t;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));updateStatus('Инструмент: '+t)}
  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  $('colorInput').addEventListener('input',e=>{color=e.target.value;$('colorHex').textContent=color.toUpperCase()});
  $('brushSize').addEventListener('input',e=>$('brushSizeValue').textContent=e.target.value);
  $('opacity').addEventListener('input',e=>$('opacityValue').textContent=e.target.value+'%');

  overlay.addEventListener('pointerdown',e=>{
    if(tool==='move')return;
    const p=pos(e);drawing=true;start=p;last=p;
    if(tool==='crop'){cropRect={x:p.x,y:p.y,w:0,h:0};return}
    if(tool==='text'){const t=prompt('Введите текст:');if(t){snapshot();const c=activeCtx();c.save();c.globalAlpha=+$('opacity').value/100;c.fillStyle=color;c.font=`bold ${Math.max(18,+$('brushSize').value*2)}px Arial`;c.fillText(t,p.x,p.y);c.restore();render()}drawing=false;return}
    if(tool==='fill'){snapshot();const c=activeCtx();c.save();c.globalAlpha=+$('opacity').value/100;c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);c.restore();render();drawing=false;return}
    snapshot();overlay.setPointerCapture(e.pointerId);
  });
  overlay.addEventListener('pointermove',e=>{
    if(!drawing||!start)return;const p=pos(e);
    if(tool==='crop'){cropRect={x:start.x,y:start.y,w:p.x-start.x,h:p.y-start.y};drawCropOverlay();return}
    const c=activeCtx();c.save();c.globalAlpha=+$('opacity').value/100;c.lineWidth=+$('brushSize').value;c.lineCap='round';c.lineJoin='round';
    if(tool==='eraser'){c.globalCompositeOperation='destination-out';c.strokeStyle='rgba(0,0,0,1)'}else{c.strokeStyle=color}
    if(tool==='brush'||tool==='eraser'){c.beginPath();c.moveTo(last.x,last.y);c.lineTo(p.x,p.y);c.stroke()}
    if(tool==='rect'){c.clearRect(0,0,canvas.width,canvas.height);c.strokeStyle=color;c.strokeRect(start.x,start.y,p.x-start.x,p.y-start.y)}
    c.restore();last=p;render();
  });
  function drawCropOverlay(){octx.clearRect(0,0,overlay.width,overlay.height);if(!cropRect)return;octx.fillStyle='rgba(0,0,0,.45)';octx.fillRect(0,0,overlay.width,overlay.height);octx.clearRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h);octx.strokeStyle='#f04452';octx.lineWidth=3;octx.setLineDash([8,5]);octx.strokeRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h);$('applyCrop').disabled=false;$('cancelCrop').disabled=false}
  overlay.addEventListener('pointerup',()=>{drawing=false;start=null;last=null;if(tool!=='crop')render()});
  $('applyCrop').addEventListener('click',()=>{if(!cropRect)return;const x=Math.max(0,Math.min(cropRect.x,cropRect.x+cropRect.w)),y=Math.max(0,Math.min(cropRect.y,cropRect.y+cropRect.h));const w=Math.min(canvas.width-x,Math.abs(cropRect.w)),h=Math.min(canvas.height-y,Math.abs(cropRect.h));if(w<2||h<2)return;const old=layers;const next=old.map(l=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(l.canvas,x,y,w,h,0,0,w,h);return {...l,canvas:c}});layers=next;canvas.width=overlay.width=w;canvas.height=overlay.height=h;cropRect=null;octx.clearRect(0,0,overlay.width,overlay.height);$('applyCrop').disabled=true;$('cancelCrop').disabled=true;renderLayers();render();fitCanvas();updateStatus('Изображение обрезано')});
  $('cancelCrop').addEventListener('click',()=>{cropRect=null;octx.clearRect(0,0,overlay.width,overlay.height);$('applyCrop').disabled=true;$('cancelCrop').disabled=true});

  $('openBtn').onclick=()=>$('fileInput').click();
  $('fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{snapshot();canvas.width=overlay.width=im.naturalWidth;canvas.height=overlay.height=im.naturalHeight;layers=[makeLayer('Фото')];activeLayer=0;activeCtx().drawImage(im,0,0);fileName=f.name;$('documentName').textContent=fileName;renderLayers();render();fitCanvas();updateStatus('Открыто: '+f.name)};im.src=URL.createObjectURL(f);e.target.value=''};
  $('newBtn').onclick=()=>{const w=+(prompt('Ширина холста:', '1200')||1200),h=+(prompt('Высота холста:', '800')||800);if(w>0&&h>0&&w<=5000&&h<=5000)init(w,h)};
  function exportImage(type){const a=document.createElement('a');const exportCanvas=document.createElement('canvas');exportCanvas.width=canvas.width;exportCanvas.height=canvas.height;const x=exportCanvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,exportCanvas.width,exportCanvas.height);for(const l of layers)if(l.visible)x.drawImage(l.canvas,0,0);x.filter=canvas.style.filter||'none';x.drawImage(canvas,0,0);a.href=exportCanvas.toDataURL(type==='jpeg'?'image/jpeg':'image/png',.92);a.download=(fileName.replace(/\.[^.]+$/,'')||'photoshop-pro')+(type==='jpeg'?'.jpg':'.png');a.click();updateStatus('Изображение скачано')}
  $('savePngBtn').onclick=()=>exportImage('png');$('saveJpgBtn').onclick=()=>exportImage('jpeg');
  $('addLayer').onclick=()=>{snapshot();layers.push(makeLayer('Слой '+(layers.length+1)));activeLayer=layers.length-1;renderLayers();updateStatus('Добавлен слой')};
  $('deleteLayer').onclick=()=>{if(layers.length<=1)return; snapshot();layers.splice(activeLayer,1);activeLayer=Math.max(0,activeLayer-1);renderLayers();render()};
  [['brightness','brightnessValue','%'],['contrast','contrastValue','%'],['saturation','saturationValue','%']].forEach(([id,val,suffix])=>$(id).addEventListener('input',e=>{adjustments[id]=+e.target.value;$(val).textContent=e.target.value+suffix;render()}));
  $('resetAdjustments').onclick=()=>{adjustments={brightness:100,contrast:100,saturation:100};['brightness','contrast','saturation'].forEach(id=>$(id).value=100);['brightnessValue','contrastValue','saturationValue'].forEach(id=>$(id).textContent='100%');filter='none';render()};
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();updateStatus('Фильтр: '+filter)});
  $('zoomIn').onclick=()=>setZoom(zoom*1.15);$('zoomOut').onclick=()=>setZoom(zoom/1.15);$('fitBtn').onclick=fitCanvas;
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();exportImage('png')}});
  init();
})();