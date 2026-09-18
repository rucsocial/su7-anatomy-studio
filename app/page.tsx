'use client';
import {flushSync} from 'react-dom';
import {useState, useRef, useEffect, type ReactNode} from 'react';
import {ArrowUpRight, Box, Layers3, RotateCcw, Rotate3d, Plus, Minus, Maximize2, X, Crosshair, ChevronRight, CircleHelp, Expand, MoreHorizontal, CloudSun, Wind, Gauge, Armchair, DoorOpen} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {getVehicle,VEHICLE_IDS,type VehicleId,type PartId} from './vehicles';
import VehicleScene, {type SceneHandle} from './vehicle-scene';
import {SEASONS,WEATHERS,DEFAULT_SEASON,DEFAULT_WEATHER,type Season,type Weather} from './environment';
import {BIOMES,DEFAULT_BIOME,type Biome} from './biomes';
export default function Home(){
 const [vehicleId,setVehicleId]=useState<VehicleId>('su7');
 const vehicle=getVehicle(vehicleId);
 const parts=vehicle.parts;const describePiece=vehicle.describePiece;
 const [selected,setSelected]=useState<PartId>('body');
 const [canFullscreen,setCanFullscreen]=useState(false);
 const [compact,setCompact]=useState(false);const [toolsOpen,setToolsOpen]=useState(false);
 const [componentsOpen,setComponentsOpen]=useState(false);const [detailOpen,setDetailOpen]=useState(false);
 const [explode,setExplode]=useState(0); const [labels,setLabels]=useState(false); const [rotate,setRotate]=useState(false); const [isolated,setIsolated]=useState(false); const [help,setHelp]=useState(false);
 // envOn gates whether picked season/weather are applied. Off always restores defaults.
 const [envOn,setEnvOn]=useState(false);
 const [pickedSeason,setPickedSeason]=useState<Season>(DEFAULT_SEASON);
 const [pickedWeather,setPickedWeather]=useState<Weather>(DEFAULT_WEATHER);
 const season=envOn?pickedSeason:DEFAULT_SEASON;
 const weather=envOn?pickedWeather:DEFAULT_WEATHER;
 const [envOpen,setEnvOpen]=useState(false);
 // Scenery shares the environment master switch: off restores the neutral studio look.
 const [pickedBiome,setPickedBiome]=useState<Biome>(DEFAULT_BIOME);
 const biome=envOn?pickedBiome:DEFAULT_BIOME;
 const [airflow,setAirflow]=useState(false); const [windSpeed,setWindSpeed]=useState(1.35); const [airflowOpen,setAirflowOpen]=useState(false);
 const [driving,setDriving]=useState(false); const [driveSpeed,setDriveSpeed]=useState(0.55); const [driveOpen,setDriveOpen]=useState(false);
 const [interiorView,setInteriorView]=useState(false);
 const [doorsOpen,setDoorsOpen]=useState(0);
 const [windowsOpen,setWindowsOpen]=useState(0);
 const [openablesOpen,setOpenablesOpen]=useState(false);
 useEffect(()=>{setCanFullscreen(Boolean(document.fullscreenEnabled));const query=window.matchMedia('(max-width: 700px), (max-height: 500px)');const update=()=>{setCompact(query.matches);setComponentsOpen(!query.matches);setToolsOpen(false)};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 const [focusedMesh,setFocusedMesh]=useState('');
 const [catalog,setCatalog]=useState<{id:string;part:PartId;label:string}[]>([]);
 useEffect(()=>{setCatalog([]);setFocusedMesh('');fetch(getVehicle(vehicleId).catalogPath).then(r=>r.json()).then(m=>setCatalog((m as {objects:{id:string;part:PartId;label:string}[]}).objects||[])).catch(()=>{});},[vehicleId]);
 const [tab,setTab]=useState('overview'); const scene=useRef<SceneHandle|null>(null); const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>unknown}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  try { Promise.resolve(context.registerTool({name:'explore_vehicle_component',description:'Select a vehicle component, set its exploded view and optionally isolate it in the 3D study.',inputSchema:{type:'object',properties:{component:{type:'string',enum:parts.map(p=>p.id)},explosion:{type:'number',minimum:0,maximum:100},isolate:{type:'boolean'}},required:['component'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input:unknown){
    const v=input as {component:PartId;explosion?:number;isolate?:boolean};
    if(!v||!parts.some(p=>p.id===v.component)||(v.explosion!==undefined&&(typeof v.explosion!=='number'||!Number.isFinite(v.explosion)||v.explosion<0||v.explosion>100))||(v.isolate!==undefined&&typeof v.isolate!=='boolean'))throw new Error('Choose a valid component and an explosion value between 0 and 100.');
    flushSync(()=>{setSelected(v.component);setFocusedMesh('');setDetailOpen(true);setTab('overview');if(window.matchMedia('(max-width: 700px), (max-height: 500px)').matches){setComponentsOpen(false);setHelp(false)}if(v.explosion!==undefined)setExplode(v.explosion);if(v.isolate!==undefined)setIsolated(v.isolate)});
    return {component:v.component,description:parts.find(p=>p.id===v.component)!.description};
  }},{signal:lifecycle.signal})).catch(()=>{}); }catch{}
  return()=>lifecycle.abort();
 },[vehicleId]);
 const part=parts.find(p=>p.id===selected)!; const piece=catalog.find(p=>p.id===focusedMesh);
 function select(id:PartId){setFocusedMesh('');setSelected(id);setTab('overview');setDetailOpen(true);if(compact){setComponentsOpen(false);setHelp(false);setToolsOpen(false);setEnvOpen(false);setAirflowOpen(false)}}
 function switchVehicle(id:VehicleId){if(id===vehicleId)return;setVehicleId(id);setFocusedMesh('');setSelected('body');setExplode(0);setIsolated(false);setLabels(false);setRotate(false);setAirflow(false);setDetailOpen(false);setHelp(false);setTab('overview');setEnvOn(false);setPickedSeason(DEFAULT_SEASON);setPickedWeather(DEFAULT_WEATHER);setPickedBiome(DEFAULT_BIOME);setEnvOpen(false);setAirflowOpen(false);setDriving(false);setDriveOpen(false);setInteriorView(false);setDoorsOpen(0);setWindowsOpen(0);setOpenablesOpen(false);}
 function pickSeason(id:Season){if(envOn&&pickedSeason===id){setEnvOn(false);return}setPickedSeason(id);setEnvOn(true)}
 function pickWeather(id:Weather){if(envOn&&pickedWeather===id){setEnvOn(false);return}setPickedWeather(id);setEnvOn(true)}
 function pickBiome(id:Biome){if(envOn&&pickedBiome===id){setEnvOn(false);return}setPickedBiome(id);setEnvOn(true)}
 function resetEnv(){setEnvOn(false);setPickedSeason(DEFAULT_SEASON);setPickedWeather(DEFAULT_WEATHER);setPickedBiome(DEFAULT_BIOME)}
 function toggleComponents(){setComponentsOpen(!componentsOpen);if(compact){setDetailOpen(false);setHelp(false);setToolsOpen(false);setEnvOpen(false);setAirflowOpen(false)}}
 function toggleHelp(){setHelp(!help);if(compact){setComponentsOpen(false);setDetailOpen(false);setToolsOpen(false);setEnvOpen(false);setAirflowOpen(false)}}
 function toggleEnv(){setEnvOpen(!envOpen);if(compact){setComponentsOpen(false);setDetailOpen(false);setHelp(false);setToolsOpen(false);setAirflowOpen(false)}}
 function toggleAirflow(on?:boolean){
  const next=on===undefined?!airflow:on;
  setAirflow(next);
  if(next){
   setExplode(0);setIsolated(false);setFocusedMesh('');setRotate(false);setAirflowOpen(true);setDriving(false);setInteriorView(false);setDoorsOpen(0);setWindowsOpen(0);
   if(compact){setComponentsOpen(false);setDetailOpen(false);setHelp(false);setEnvOpen(false);setToolsOpen(false)}
  }else setAirflowOpen(false);
 }
 function toggleDrive(on?:boolean){
  const next=on===undefined?!driving:on;
  setDriving(next);
  if(next){
   setExplode(0);setIsolated(false);setAirflow(false);setFocusedMesh('');setDriveOpen(true);setInteriorView(false);setDoorsOpen(0);setWindowsOpen(0);
  }else setDriveOpen(false);
 }
 function toggleInterior(on?:boolean){
  const next=on===undefined?!interiorView:on;
  setInteriorView(next);
  if(next){
   setExplode(0);setIsolated(false);setAirflow(false);setFocusedMesh('');setRotate(false);setDriving(false);setDriveOpen(false);
   if(compact){setComponentsOpen(false);setDetailOpen(false);setHelp(false);setEnvOpen(false);setToolsOpen(false)}
  }
 }

 function renderAboutText(text:string){
  const out:ReactNode[]=[];const re=/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;let last=0;let m:RegExpExecArray|null;let k=0;
  while((m=re.exec(text))){if(m.index>last)out.push(text.slice(last,m.index));out.push(<a key={k++} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>);last=m.index+m[0].length}
  if(last<text.length)out.push(text.slice(last));return out;
 }
 return <main className={'studio'+(airflow?' airflow-mode':'')} ref={root}>
  <section className="stage-view" aria-label={'Interactive '+vehicle.brand+' '+vehicle.model+' studio'}>
   <VehicleScene key={vehicleId} vehicle={vehicleId} focusedMesh={focusedMesh} onInspect={setFocusedMesh} ref={scene} selected={selected} explode={explode} labels={labels} autoRotate={rotate} isolated={isolated} onSelect={select} season={season} weather={weather} biome={biome} airflow={airflow} windSpeed={windSpeed} driving={driving} driveSpeed={driveSpeed} interiorView={interiorView} doorsOpen={doorsOpen} windowsOpen={windowsOpen}/>
  </section>
  <div className="model-plaque"><span>{vehicle.plaqueTop}</span><h1>{vehicle.plaqueTitle}</h1></div>
  <div className="vehicle-switcher floating-panel" aria-label="Vehicle">
   {VEHICLE_IDS.map(id=>{const v=getVehicle(id);return <button key={id} className={'vehicle-chip '+(id===vehicleId?'active':'')} onClick={()=>switchVehicle(id)} aria-pressed={id===vehicleId}>{v.switcherLabel||v.model}</button>})}
  </div>
  {componentsOpen&&<aside className="components-panel floating-panel" aria-label="Components">
   <div className="panel-heading"><h2>Components</h2><button className="icon-button" onClick={()=>setComponentsOpen(false)} aria-label="Hide components"><X size={14}/></button></div>
   <div className="parts-list">{parts.map((p,i)=><button key={p.id} onClick={()=>select(p.id)} className={'part-row '+(p.id===selected&&detailOpen?'selected':'')} aria-pressed={p.id===selected&&detailOpen}><span className="part-number">{String(i+1).padStart(2,'0')}</span><span>{p.name}</span><ChevronRight size={13}/></button>)}</div>
  </aside>}
  <nav className="view-tools floating-panel" data-expanded={toolsOpen} aria-label="View controls">
   <button className={'tools-components '+(componentsOpen?'active':'')} title="Components" onClick={toggleComponents} aria-label="Toggle components" aria-pressed={componentsOpen}><Layers3 size={18}/></button>
   <span/>
   <button className="tools-extra" title="Zoom in" onClick={()=>scene.current?.zoom(.85)} aria-label="Zoom in"><Plus size={18}/></button>
   <button className="tools-extra" title="Zoom out" onClick={()=>scene.current?.zoom(1.18)} aria-label="Zoom out"><Minus size={18}/></button>
   <button className="tools-reset" title="Reset view" onClick={()=>{setRotate(false);scene.current?.reset()}} aria-label="Reset view"><RotateCcw size={17}/></button>
   <button className={'tools-extra '+(rotate?'active':'')} title="Auto rotate" onClick={()=>setRotate(!rotate)} aria-label="Toggle auto rotation" aria-pressed={rotate}><Rotate3d size={18}/></button>
   <button className={'tools-extra '+(envOpen?'active':'')} title="Environment" onClick={toggleEnv} aria-label="Environment and weather" aria-expanded={envOpen}><CloudSun size={18}/></button>
   <button className={'tools-extra '+(airflow?'active':'')} title="Wind tunnel" onClick={()=>toggleAirflow()} aria-label="Toggle wind tunnel airflow" aria-pressed={airflow}><Wind size={18}/></button>
    <button className={'tools-extra '+(driving?'active':'')} title="Drive" onClick={()=>toggleDrive()} aria-label="Toggle drive mode" aria-pressed={driving}><Gauge size={18}/></button>
    <button className={'tools-extra '+(interiorView?'active':'')} title="Interior 3D view" onClick={()=>toggleInterior()} aria-label="Toggle interior view" aria-pressed={interiorView}><Armchair size={18}/></button>
    <button className={'tools-extra '+(openablesOpen||doorsOpen>0||windowsOpen>0?'active':'')} title="Open doors / windows" onClick={()=>setOpenablesOpen(!openablesOpen)} aria-label="Openable parts" aria-expanded={openablesOpen}><DoorOpen size={18}/></button>
   <span/>
   {canFullscreen&&<button className="tools-extra" title="Fullscreen" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else root.current?.requestFullscreen?.()}} aria-label="Toggle fullscreen"><Maximize2 size={17}/></button>}
   <button className="tools-extra" title="About this model" onClick={toggleHelp} aria-label="About this model" aria-expanded={help}><CircleHelp size={17}/></button>
   <button className="tools-more" title="More view controls" onClick={()=>setToolsOpen(!toolsOpen)} aria-label="More view controls" aria-expanded={toolsOpen}><MoreHorizontal size={20}/></button>
  </nav>
  {detailOpen&&<aside className="detail-panel floating-panel" aria-label="Component details">
   <div className="panel-heading"><span>{part.category}{['battery','drive','suspension'].includes(selected)&&<span className="illustrative-badge">Illustrative</span>}</span><button className="icon-button" onClick={()=>setDetailOpen(false)} aria-label="Close details"><X size={16}/></button></div>
   <div className="detail" aria-live="polite">
    <h2>{piece?piece.label:part.name}</h2>
    <Tabs value={tab} onValueChange={v=>setTab(String(v))}><TabsList variant="line" className="detail-tabs"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="working">How it works</TabsTrigger></TabsList></Tabs>
    <p className="detail-copy">{piece&&tab==='overview'?describePiece(piece.label):tab==='overview'?part.description:part.principle}</p>
    <dl className="specs">{part.specs.map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
    {catalog.some(p=>p.part===selected)&&<div className="piece-picker"><span>Individual pieces</span><Select value={focusedMesh||'all'} onValueChange={value=>setFocusedMesh(value==='all'?'':String(value))}><SelectTrigger aria-label="Choose an individual mesh piece"><SelectValue>{piece?piece.label:`All ${catalog.filter(p=>p.part===selected).length} pieces`}</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{[{id:'all',label:'All pieces in this system'},...catalog.filter(p=>p.part===selected)].map((p,i)=><SelectItem key={p.id} value={p.id}>{i?`${String(i).padStart(2,'0')} · `:''}{p.label}</SelectItem>)}</SelectContent></Select></div>}
    <button className={'isolate-button '+(isolated?'is-active':'')} onClick={()=>setIsolated(!isolated)}>{isolated?<Layers3 size={15}/>:<Crosshair size={15}/>} {isolated?'Show everything':focusedMesh?'Isolate piece':'Isolate component'}</button>
    <a className="source-link" href={part.source} target="_blank" rel="noreferrer">Xiaomi SU7 page <ArrowUpRight size={12}/></a>
   </div>
  </aside>}
  <div className="explode-dock floating-panel" aria-label="Assembly controls">
   <button className={'assembly-button '+(explode===0?'active':'')} title="Assemble" onClick={()=>{setExplode(0);setIsolated(false)}} aria-label="Assemble vehicle"><Box size={18}/><span>Assemble</span></button>
   <div className="explode-control"><div className="slider-caption"><label id="explode-label">Explode</label><output>{explode===100?`${catalog.length} pieces`:`${explode}%`}</output></div><Slider aria-labelledby="explode-label" value={[explode]} onValueChange={v=>{const n=Array.isArray(v)?v[0]:v;setExplode(n);if(n>5){setDoorsOpen(0);setWindowsOpen(0)}}} min={0} max={100}/></div>
   <button className={'assembly-button '+(explode===100?'active':'')} title="Separate all pieces" onClick={()=>{setExplode(100);setIsolated(false)}} aria-label="Separate all pieces"><Expand size={18}/><span>All parts</span></button>
   <div className="dock-divider"/><label className="labels-toggle"><Switch checked={labels} onCheckedChange={setLabels} aria-label="Show labels"/><span>Labels</span></label>
  </div>
  {help&&<aside className="about-panel floating-panel" aria-label="About this model"><div className="panel-heading"><h2>About the model</h2><button className="icon-button" onClick={()=>setHelp(false)} aria-label="Close model information"><X size={15}/></button></div>{vehicle.about.paragraphs.map((para,i)=><p key={i}>{renderAboutText(para)}</p>)}<p className="about-meta">{catalog.length||39} mesh pieces · {vehicle.brand} {vehicle.model}</p></aside>}
  {envOpen&&<aside className="env-panel floating-panel" aria-label="Environment">
   <div className="panel-heading"><h2>Environment</h2><button className="icon-button" onClick={()=>setEnvOpen(false)} aria-label="Close environment"><X size={14}/></button></div>
   <div className="env-body">
    <div className="env-group">
     <span className="env-label">Scenery</span>
     <div className="env-chips" role="group" aria-label="Scenery">
      {BIOMES.map(b=><button key={b.id} className={'env-chip '+(biome===b.id?'active':'')} onClick={()=>pickBiome(b.id)} aria-pressed={biome===b.id} title={b.hint}>{b.name}</button>)}
     </div>
    </div>
    <div className="env-group">
     <span className="env-label">Season</span>
     <div className="env-chips" role="group" aria-label="Season">
      {SEASONS.map(s=><button key={s.id} className={'env-chip '+(season===s.id?'active':'')} onClick={()=>pickSeason(s.id)} aria-pressed={season===s.id} title={s.hint}>{s.name}</button>)}
     </div>
    </div>
    <div className="env-group">
     <span className="env-label">Weather</span>
     <div className="env-chips" role="group" aria-label="Weather">
      {WEATHERS.map(w=><button key={w.id} className={'env-chip '+(weather===w.id?'active':'')} onClick={()=>pickWeather(w.id)} aria-pressed={weather===w.id} title={w.hint}>{w.name}</button>)}
     </div>
    </div>
    <label className="env-master"><Switch checked={envOn} onCheckedChange={setEnvOn} aria-label="Apply environment effects"/><span>{envOn?'Effects on — tap active chip to turn off':'Effects off — default look'}</span></label>
    <p className="env-note">{envOn?`${BIOMES.find(b=>b.id===biome)?.hint} · ${SEASONS.find(s=>s.id===season)?.hint} · ${WEATHERS.find(w=>w.id===weather)?.hint}`:'Studio · Summer · Sunny (default)'}</p>
    <button className="env-reset" onClick={resetEnv} disabled={!envOn&&pickedSeason===DEFAULT_SEASON&&pickedWeather===DEFAULT_WEATHER&&pickedBiome===DEFAULT_BIOME}>Turn off & reset</button>
   </div>
  </aside>}
  {interiorView&&<aside className="drive-panel floating-panel" aria-label="Interior view">
   <div className="panel-heading"><h2>Interior · 内饰</h2><button className="icon-button" onClick={()=>toggleInterior(false)} aria-label="Exit interior view"><X size={14}/></button></div>
   <div className="drive-body">
    <p className="drive-desc">座舱视角：左键旋转环视，右键/双指平移，滚轮缩放，WASD/方向键移动。车身半透明以保留前/后背箱轮廓。</p>
    <button className="isolate-button" onClick={()=>toggleInterior(false)}>Back to exterior</button>
   </div>
  </aside>}
  {openablesOpen&&<aside className="drive-panel floating-panel" aria-label="Openable parts">
   <div className="panel-heading"><h2>Openables · 开闭</h2><button className="icon-button" onClick={()=>setOpenablesOpen(false)} aria-label="Close openables"><X size={14}/></button></div>
   <div className="drive-body">
    <p className="drive-desc">
     {vehicle.openables.doors
      ? '海湾蓝：四门铰链外开，车窗玻璃可下滑。'
      : '概览版车门与车身一体，无法单独开合；全景天幕为固定玻璃，不做滑动。'}
     两车 GLB 均无独立前/后背箱盖，无法做开箱动画。
    </p>
    {vehicle.openables.doors&&<>
     <div className="slider-caption"><label id="doors-label">Doors · 车门</label><output>{Math.round(doorsOpen*100)}%</output></div>
     <Slider aria-labelledby="doors-label" value={[doorsOpen]} onValueChange={v=>setDoorsOpen(Array.isArray(v)?v[0]:v)} min={0} max={1} step={0.01}/>
     <div className="slider-caption" style={{marginTop:12}}><label id="win-label">Windows · 车窗</label><output>{Math.round(windowsOpen*100)}%</output></div>
     <Slider aria-labelledby="win-label" value={[windowsOpen]} onValueChange={v=>setWindowsOpen(Array.isArray(v)?v[0]:v)} min={0} max={1} step={0.01}/>
    </>}
    <div style={{display:'flex',gap:8,marginTop:12}}>
     <button className="env-reset" style={{margin:0}} onClick={()=>{setDoorsOpen(0);setWindowsOpen(0)}}>Close all</button>
     <button className="env-reset" style={{margin:0}} onClick={()=>{if(vehicle.openables.doors){setDoorsOpen(1);setWindowsOpen(0.55)}}}>Open all</button>
    </div>
   </div>
  </aside>}
  {driveOpen&&<aside className="drive-panel floating-panel" aria-label="Drive">
   <div className="panel-heading"><h2>Drive</h2><button className="icon-button" onClick={()=>{toggleDrive(false)}} aria-label="Stop driving"><X size={14}/></button></div>
   <div className="drive-body">
    <p className="drive-desc">{driving?'Wheels spin and the ground scrolls. Exploded or wind-tunnel mode stops the car.':'Press drive to scroll the floor (SU7 also spins wheels)'}</p>
    <div className="slider-caption"><label id="drive-label">Speed</label><output>{Math.round(driveSpeed*80)} km/h</output></div>
    <Slider aria-labelledby="drive-label" value={[driveSpeed]} onValueChange={v=>setDriveSpeed(Array.isArray(v)?v[0]:v)} min={0.15} max={1.2} step={0.05}/>
    <button className={'isolate-button '+(driving?'is-active':'')} onClick={()=>toggleDrive(!driving)}>{driving?'Stop':'Start driving'}</button>
   </div>
  </aside>}
  {airflow&&<aside className="airflow-panel floating-panel" aria-label="Wind tunnel">
   <div className="panel-heading"><h2>Wind tunnel</h2><button className="icon-button" onClick={()=>toggleAirflow(false)} aria-label="Exit wind tunnel"><X size={14}/></button></div>
   <div className="airflow-body">
    <p className="airflow-desc">Air flows nose to tail around the assembled body. Streamlines speed up over the crown and tumble in the wake.</p>
    <div className="slider-caption"><label id="wind-label">Wind speed</label><output>{windSpeed.toFixed(1)}×</output></div>
    <Slider aria-labelledby="wind-label" value={[windSpeed]} onValueChange={v=>setWindSpeed(Array.isArray(v)?v[0]:v)} min={0.4} max={3.2} step={0.1}/>
   </div>
  </aside>}
 </main>
}
