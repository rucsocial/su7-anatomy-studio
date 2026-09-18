'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createExplosionLayout,layoutCenter,overviewDirection} from './explosion-layout';
import {PointerTap} from './pointer-tap';
import {getVehicle,type VehicleId,type PartId} from './vehicles';
import {resolveEnvironment,type EnvironmentConfig,type Season,type Weather} from './environment';
import {createParticleSystem,updateParticles,disposeParticles,type ParticleState} from './weather-particles';
import {createAirflow,type AirflowSystem} from './airflow';
import {type Biome} from './biomes';
import {createBiomeScene,type BiomeScene} from './biome-scene';
export type SceneHandle={zoom:(factor:number)=>void;reset:()=>void};
type Props={vehicle:VehicleId;focusedMesh:string;onInspect:(id:string)=>void;selected:PartId;explode:number;labels:boolean;autoRotate:boolean;isolated:boolean;onSelect:(id:PartId)=>void;season:Season;weather:Weather;biome:Biome;airflow:boolean;windSpeed:number;driving:boolean;driveSpeed:number;interiorView:boolean;doorsOpen:number;windowsOpen:number};
const offsets:Record<PartId,[number,number,number]>={body:[0,.6,0],glass:[0,2,0],doors:[0,1.1,0],cabin:[0,.7,0],battery:[0,-.85,0],drive:[0,-.18,0],suspension:[0,.08,0],wheels:[0,0,0]};
const VehicleScene=forwardRef<SceneHandle,Props>(function VehicleScene(props,ref){
 const host=useRef<HTMLDivElement>(null);const latest=useRef(props);latest.current=props;
 const engine=useRef<{camera:THREE.PerspectiveCamera;controls:OrbitControls;reset:()=>void;interrupt:()=>void}|null>(null);
 const envApi=useRef<{apply:(cfg:EnvironmentConfig,immediate?:boolean)=>void}|null>(null);
 const airflowApi=useRef<AirflowSystem|null>(null);
 const biomeApi=useRef<BiomeScene|null>(null);
 const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const [sceneryBusy,setSceneryBusy]=useState(false);
 useImperativeHandle(ref,()=>({zoom(f){const e=engine.current;if(e){e.interrupt();e.camera.position.sub(e.controls.target).multiplyScalar(f).add(e.controls.target)}},reset(){const e=engine.current;if(e){e.reset()}}}),[]);
 useEffect(()=>{envApi.current?.apply(resolveEnvironment(props.season,props.weather))},[props.season,props.weather]);
 useEffect(()=>{biomeApi.current?.apply(props.biome)},[props.biome]);
 useEffect(()=>{airflowApi.current?.setEnabled(props.airflow)},[props.airflow]);
 useEffect(()=>{airflowApi.current?.setWindSpeed(props.windSpeed)},[props.windSpeed]);
 useEffect(()=>{
  setReady(false);setError(null);
  const vehicle=getVehicle(latest.current.vehicle);
  const parts=vehicle.parts;
  const anchors=vehicle.anchors;
  const el=host.current!; let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'})}catch{setError('Your browser could not start the 3D view.');return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,window.matchMedia('(pointer: coarse)').matches?1.25:1.5));renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();const initialEnv=resolveEnvironment(latest.current.season,latest.current.weather);
  scene.background=new THREE.Color(initialEnv.background);scene.fog=new THREE.Fog(initialEnv.fogColor,initialEnv.fogNear,initialEnv.fogFar);
  const camera=new THREE.PerspectiveCamera(37,1,.05,500);camera.position.set(-5.7,2.9,6.3);
  renderer.toneMappingExposure=initialEnv.exposure;
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=5;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.18;controls.enablePan=true;controls.autoRotateSpeed=.65;engine.current={camera,controls,reset:()=>{fitView(true);invalidated=true},interrupt:()=>{framingTime=0}};
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;
  const hemi=new THREE.HemisphereLight(initialEnv.hemisphereSky,initialEnv.hemisphereGround,initialEnv.hemisphereIntensity);scene.add(hemi);
  const key=new THREE.DirectionalLight(initialEnv.keyColor,initialEnv.keyIntensity);key.position.set(-4,8,4);scene.add(key);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.bias=-.001;
  const rim=new THREE.DirectionalLight(initialEnv.rimColor,initialEnv.rimIntensity);rim.position.set(3,4,-5);scene.add(rim);
  const glow=new THREE.PointLight(initialEnv.glowColor,initialEnv.glowIntensity,10);glow.position.set(1,0,4);scene.add(glow);
  const mat=(color:string,metal=.3,rough=.32)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
  const dark=mat('#13181d',.28,.36),silver=mat('#94a2ae',.85,.25),orange=mat('#f97645',.55,.32);
  const groups={} as Record<PartId,THREE.Group>;parts.forEach(p=>{const g=new THREE.Group();g.name=p.id;g.userData.part=p.id;groups[p.id]=g;scene.add(g)});
  function mesh(g:THREE.Group,geometry:THREE.BufferGeometry,m:THREE.Material,pos:[number,number,number]=[0,0,0]){const o=new THREE.Mesh(geometry,m.clone());o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;o.userData.part=g.userData.part;g.add(o);return o}
  function box(g:THREE.Group,s:[number,number,number],p:[number,number,number],m:THREE.Material,r=.04){return mesh(g,new RoundedBoxGeometry(...s,3,r),m,p)}
  function cyl(g:THREE.Group,r:number,len:number,p:[number,number,number],m:THREE.Material){const o=mesh(g,new THREE.CylinderGeometry(r,r,len,36),m,p);o.rotation.x=Math.PI/2;return o}
  function tube(g:THREE.Group,points:THREE.Vector3[],r:number,m:THREE.Material){return mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,r,8,false),m)}
  // Battery, drive and suspension are illustrative geometry (SU7 platform: length along Z).
  {
   // SU7 platform: length along Z (front = -Z), up = +Y, metric. Wheelbase ~2.99 m.
   box(groups.battery,[1.72,.16,2.78],[0,.27,0],silver,.05);
   box(groups.battery,[1.60,.06,2.62],[0,.38,0],dark,.02);
   for(let x=0;x<5;x++)for(let z=0;z<8;z++)box(groups.battery,[.28,.05,.28],[-.64+x*.32,.43,-1.12+z*.32],mat('#6d827e',.65,.38),.015);
   [-1,1].forEach(s=>box(groups.battery,[1.62,.03,.03],[0,.47,s*1.28],orange,.008));
   // Front and rear drive units (dual-motor layout, illustrative).
   [-1.48,1.05].forEach(z=>{cyl(groups.drive,.18,.62,[0,.42,z],silver);cyl(groups.drive,.08,1.55,[0,.40,z],dark);box(groups.drive,[.40,.14,.42],[0,.62,z],silver);for(let j=0;j<6;j++)box(groups.drive,[.02,.035,.36],[-.16+j*.064,.71,z],dark,.003);tube(groups.drive,[new THREE.Vector3(0,.55,z+.28),new THREE.Vector3(0,.40,z+.42),new THREE.Vector3(0,.32,z+.48)],.022,orange)});
   // Suspension struts at each wheel corner (from manifest wheel centers).
   [[-.86,-1.72],[.84,-1.73],[-.86,1.29],[.87,1.27]].forEach(([x,z])=>{const strut=cyl(groups.suspension,.075,.38,[x,.72,z],silver);strut.rotation.x=0;for(let j=0;j<4;j++){const ring=mesh(groups.suspension,new THREE.TorusGeometry(.095,.022,8,20),dark,[x,.60+j*.05,z]);ring.rotation.x=Math.PI/2;}tube(groups.suspension,[new THREE.Vector3(x*.55,.34,z),new THREE.Vector3(x,.36,z)],.02,silver)});
  }
  // The exterior, wheels and interior below are the creator's actual imported mesh.
  const readyRef={current:false};
  let cancelled=false;
  // ---- Biome layer: sky + image-based lighting + ground PBR + distant scenery.
  // It owns scene.environment / the sky meshes / the ground meshes / the scenery groups,
  // so the season-weather code below must go through setGroundLook() and params().
  const biomeScene=createBiomeScene({scene,renderer,pmrem,studioEnv:env.texture,onBusy:b=>{if(!cancelled)setSceneryBusy(b)}});
  biomeApi.current=biomeScene;
  if(latest.current.biome!=='studio')biomeScene.apply(latest.current.biome);
  const pieces:{node:THREE.Object3D;home:THREE.Vector3;spread:THREE.Vector3;part:PartId;id:string;bounds:THREE.Box3;center:THREE.Vector3;fullSpread:THREE.Vector3;materials:THREE.MeshStandardMaterial[]}[]=[];
  let layout:ReturnType<typeof createExplosionLayout>|null=null;
  const pieceLabels:{b:HTMLButtonElement;id:string;part:PartId;center:THREE.Vector3;spread:THREE.Vector3;fullSpread:THREE.Vector3}[]=[];
  // Openable hinges (detail doors) and roof glass (overview). Mounted once after GLB attach.
  type DoorHinge={pivot:THREE.Group;sign:number;windows:{node:THREE.Object3D;homeY:number}[]};
  let doorHinges:DoorHinge[]=[];
  let doorHingesMounted=false;
  function unmountDoorHinges(){
   if(!doorHingesMounted)return;
   for(const d of doorHinges){
    d.pivot.rotation.set(0,0,0);
    while(d.pivot.children.length)groups.doors.attach(d.pivot.children[0]);
    d.pivot.removeFromParent();
   }
   doorHinges=[];
   // Drop only door meshes from the pivot-owned set (wheels keep their entries).
   for(const piece of pieces){
    if(piece.part==='doors'){
     pivotedPieces.delete(piece.node);
     piece.home.copy(piece.node.position);
    }
   }
   doorHingesMounted=false;
  }
  const disposeObject=(root:THREE.Object3D)=>root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});
  new GLTFLoader().load(vehicle.modelPath,gltf=>{
   if(cancelled){disposeObject(gltf.scene);return}
   Object.values(groups).forEach(g=>g.position.set(0,0,0));scene.updateMatrixWorld(true);
   const model=gltf.scene;
   model.rotation.set(...vehicle.rotation);
   model.scale.setScalar(vehicle.scale);
   scene.add(model);model.updateMatrixWorld(true);
   // Semantic node names map into part groups.
   const nodes:{node:THREE.Object3D;part:PartId;component:string;label:string}[]=[];
   if(vehicle.nodeMap){
    const byName=new Map<string,THREE.Object3D>();
    model.traverse(o=>{if(o.name&&!byName.has(o.name))byName.set(o.name,o)});
    for(const [name,meta] of Object.entries(vehicle.nodeMap)){
     const o=byName.get(name);
     if(o)nodes.push({node:o,part:meta.part,component:name,label:meta.label});
    }
   }else{
    model.traverse(o=>{if(o.userData.component&&o.userData.part)nodes.push({node:o,part:o.userData.part as PartId,component:String(o.userData.component),label:String(o.userData.label||'Modeled piece')})});
   }
   nodes.forEach(({node,part:id,component,label})=>{
    if(!groups[id])return;
    node.userData.component=component;node.userData.label=label;
    groups[id].attach(node);
    const bounds=new THREE.Box3().setFromObject(node);const center=bounds.getCenter(new THREE.Vector3());
    const side=Math.sign(center.z)||1;
    const spread=new THREE.Vector3(id==='body'?center.x*.17:0,0,id==='wheels'?side*.95:id==='doors'?side*.9:id==='glass'?side*.12:0);
    pieces.push({node,home:node.position.clone(),spread,part:id,id:component,bounds,center,fullSpread:new THREE.Vector3(),materials:[]});
    node.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.part=id;o.userData.component=component;o.castShadow=true;o.receiveShadow=true;
     const materials=Array.isArray(o.material)?o.material:[o.material];o.material=Array.isArray(o.material)?materials.map(m=>m.clone()):materials[0].clone();
     (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){if(m instanceof THREE.MeshPhysicalMaterial&&m.transmission>0){m.transmission=0;m.metalness=.25;m.roughness=.18}
      pieces[pieces.length-1].materials.push(m);m.envMapIntensity=1.3;m.userData.baseEmission=m.emissive.clone();m.userData.baseIntensity=m.emissiveIntensity;}});
    }});
   });
   layout=createExplosionLayout(pieces);
   pieces.forEach((piece,i)=>{
    piece.fullSpread.copy(layout!.pieces.get(piece.id)!.translation);
    const b=document.createElement('button');b.className='mesh-marker';b.textContent=String(i+1);b.title=piece.node.userData.label||'Modeled piece';b.setAttribute('aria-label',`Inspect piece ${i+1}: ${b.title}`);
    b.addEventListener('click',()=>{latest.current.onSelect(piece.part);latest.current.onInspect(piece.id)});el.appendChild(b);
    pieceLabels.push({b,id:piece.id,part:piece.part,center:piece.center,spread:piece.spread,fullSpread:piece.fullSpread});
   });
   const positions=new Float32Array(pieces.length*3);markerGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
   scene.remove(model);
   // Exterior Car_body lives on body panels AND door skins — paint both so they match.
   if(vehicle.paintHex){
    const paint=new THREE.Color(vehicle.paintHex);
    for(const piece of pieces){
     if(piece.part!=='body'&&piece.part!=='doors')continue;
     for(const m of piece.materials){
      const nm=(m.name||'').toLowerCase();
      if(nm.includes('car_body')&&!nm.includes('inside')&&!nm.includes('window')&&!nm.includes('light')){
       m.color.copy(paint);
       m.metalness=0.42;
       m.roughness=0.28;
      }
     }
    }
   }
   if(vehicle.screenTintPath){
    const prefixes=(vehicle.screenTintMaterialNames||[]).map(s=>s.toLowerCase());
    new THREE.TextureLoader().load(vehicle.screenTintPath,tex=>{
     if(cancelled)return;
     tex.colorSpace=THREE.SRGBColorSpace;
     tex.flipY=false;
     const patch=(m:THREE.Material)=>{
      const nm=(m.name||'').toLowerCase();
      if(!prefixes.some(p=>nm.startsWith(p)))return;
      if(m instanceof THREE.MeshStandardMaterial){
       m.map=tex;m.needsUpdate=true;
      }
     };
     for(const piece of pieces)for(const m of piece.materials)patch(m as THREE.Material);
    });
   }
   if(vehicle.visualTweak==='spoiler-down'){
    // Object_12 lives under groups.body after reparent — not under `model`.
    const spoil=groups.body.getObjectByName('Object_12')||pieces.find(p=>p.node.name==='Object_12')?.node;
    if(spoil){
     spoil.position.y-=0.09;
     spoil.updateMatrixWorld(true);
    }
   }
   // ---- Openables: door hinges only (detail). Lookup MUST use part groups / pieces. ----
   // Hinge on leading edge (front → min Z / nose −Z, rear → max Z).
   // Swing: left door (x<0) rotates −Y so the free edge moves outward (−X);
   //        right door (x>0) rotates +Y so the free edge moves outward (+X).
   doorHinges=[];
   if(vehicle.openables.doors){
    const byName=new Map<string,THREE.Object3D>();
    groups.doors.traverse(o=>{if(o.name)byName.set(o.name,o)});
    for(const piece of pieces)if(piece.part==='doors'&&piece.node.name)byName.set(piece.node.name,piece.node);
    const DOOR_SETS:string[][]=[
     ['Object_31','Object_32','Object_33','Object_34','Object_35','Object_36'], // FL
     ['Object_38','Object_39','Object_40','Object_41','Object_42'],             // RL
     ['Object_44','Object_45','Object_46','Object_47','Object_48','Object_49'], // FR
     ['Object_51','Object_52','Object_53','Object_54'],                         // RR
    ];
    // Conventional doors: ALL four hinge at the FRONT edge (min Z, toward nose −Z).
    // Front doors hinge at A-pillar; rear doors at B-pillar. Never at C-pillar (suicide / 对开门).
    // Swing: left (x<0) −Y, right (x>0) +Y so the free edge moves outward.
    const WINDOW_NAMES=new Set(['Object_36','Object_49']); // real glass only — NOT mirror (33/46) or mirror cap (34/47)
    groups.doors.updateMatrixWorld(true);
    for(const names of DOOR_SETS){
     const meshes=names.map(n=>byName.get(n)).filter((o):o is THREE.Object3D=>!!o);
     if(meshes.length<2)continue;
     const box=new THREE.Box3();
     for(const m of meshes)box.expandByObject(m);
     const c=box.getCenter(new THREE.Vector3());
     const hingeZ=box.min.z; // always the front edge of this door
     const pivot=new THREE.Group();
     pivot.name='door_hinge';
     const local=new THREE.Vector3(c.x,c.y,hingeZ);
     groups.doors.worldToLocal(local);
     pivot.position.copy(local);
     groups.doors.add(pivot);
     const windows:DoorHinge['windows']=[];
     for(const m of meshes){
      pivot.attach(m);
      pivotedPieces.add(m);
      if(WINDOW_NAMES.has(m.name))windows.push({node:m,homeY:m.position.y});
     }
     // Left door free edge must move −X, right +X. With hinge at min Z (z_rel>0 to free edge):
     // left needs −Y rotation, right +Y.
     const swing=c.x<0?-1:1;
     doorHinges.push({pivot,sign:swing,windows});
    }
    for(const piece of pieces){
     if(pivotedPieces.has(piece.node))piece.home.copy(piece.node.position);
    }
    doorHingesMounted=true;
   }
   readyRef.current=true;setReady(true);fitView(true);invalidated=true;renderer.shadowMap.needsUpdate=true;
  },undefined,()=>{if(!cancelled)setError('The detailed car could not load. Reload to try again.')});
  const markerGeometry=new THREE.BufferGeometry();
  const markerMaterial=new THREE.PointsMaterial({color:0xf6bc99,size:4,sizeAttenuation:false,depthWrite:false,depthTest:false,transparent:true,opacity:.75});
  const markers=new THREE.Points(markerGeometry,markerMaterial);markers.visible=false;markers.frustumCulled=false;markers.renderOrder=10;scene.add(markers);
  // A low display plinth and studio floor frame the car without extra render passes.
  const stage=new THREE.Group();scene.add(stage);
  const stageMaterial=new THREE.MeshStandardMaterial({color:initialEnv.plinthColor,metalness:.35,roughness:.48,transparent:true});
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(3.55,3.6,.13,96),stageMaterial);plinth.position.y=-.12;plinth.receiveShadow=true;stage.add(plinth);
  const rimMaterial=new THREE.MeshStandardMaterial({color:0xa6b9c9,metalness:.7,roughness:.35,transparent:true});
  for(const radius of [3.36,3.51]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.007,5,128),rimMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=-.05;stage.add(ring)}
  // Ground plane + PBR maps + scenery belong to the biome layer above; the grid stays a studio tool.
  const grid=new THREE.GridHelper(100,100,0x657182,0x566272);grid.position.y=-.185;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.13;scene.add(grid);
  // Environment target/lerp state for seasons and weather.
  let envTarget=initialEnv;
  let envReady=false;
  let particles:ParticleState|null=createParticleSystem(initialEnv.particles,scene);
  let particleMode=initialEnv.particles;
  const envLive={
   background:new THREE.Color(initialEnv.background),
   fog:new THREE.Color(initialEnv.fogColor),
   fogNear:initialEnv.fogNear,
   fogFar:initialEnv.fogFar,
   hemiSky:new THREE.Color(initialEnv.hemisphereSky),
   hemiGround:new THREE.Color(initialEnv.hemisphereGround),
   hemiIntensity:initialEnv.hemisphereIntensity,
   key:new THREE.Color(initialEnv.keyColor),
   keyIntensity:initialEnv.keyIntensity,
   rim:new THREE.Color(initialEnv.rimColor),
   rimIntensity:initialEnv.rimIntensity,
   glow:new THREE.Color(initialEnv.glowColor),
   glowIntensity:initialEnv.glowIntensity,
   ground:new THREE.Color(initialEnv.groundColor),
   groundRoughness:initialEnv.groundRoughness,
   groundMetalness:initialEnv.groundMetalness,
   plinth:new THREE.Color(initialEnv.plinthColor),
   exposure:initialEnv.exposure,
   envIntensity:initialEnv.envIntensity,
  };
  function setParticleMode(mode:EnvironmentConfig['particles']){
   if(mode===particleMode)return;
   disposeParticles(particles);particles=null;particleMode=mode;
   if(mode!=='none')particles=createParticleSystem(mode,scene);
  }
  const tmpColor=new THREE.Color();
  // Materials whose envMapIntensity tracks envLive.envIntensity × the biome multiplier.
  // Before this, EnvironmentConfig.envIntensity was lerped every frame and never applied.
  let appliedEnv=-1;
  function applyEnvIntensity(value:number){
   if(Math.abs(value-appliedEnv)<.01)return;
   appliedEnv=value;
   for(const piece of pieces)for(const m of piece.materials)m.envMapIntensity=value;
  }
  function tickEnvironment(dt:number){
   const bp=biomeScene.params();
   const rate=1-Math.exp(-3.2*dt);
   const t=envTarget;
   envLive.background.lerp(tmpColor.set(t.background),rate);
   envLive.fog.lerp(tmpColor.set(t.fogColor),rate);
   envLive.fogNear=THREE.MathUtils.lerp(envLive.fogNear,t.fogNear,rate);
   envLive.fogFar=THREE.MathUtils.lerp(envLive.fogFar,t.fogFar,rate);
   envLive.hemiSky.lerp(tmpColor.set(t.hemisphereSky),rate);
   envLive.hemiGround.lerp(tmpColor.set(t.hemisphereGround),rate);
   envLive.hemiIntensity=THREE.MathUtils.lerp(envLive.hemiIntensity,t.hemisphereIntensity,rate);
   envLive.key.lerp(tmpColor.set(t.keyColor),rate);
   envLive.keyIntensity=THREE.MathUtils.lerp(envLive.keyIntensity,t.keyIntensity,rate);
   envLive.rim.lerp(tmpColor.set(t.rimColor),rate);
   envLive.rimIntensity=THREE.MathUtils.lerp(envLive.rimIntensity,t.rimIntensity,rate);
   envLive.glow.lerp(tmpColor.set(t.glowColor),rate);
   envLive.glowIntensity=THREE.MathUtils.lerp(envLive.glowIntensity,t.glowIntensity,rate);
   envLive.ground.lerp(tmpColor.set(t.groundColor),rate);
   envLive.groundRoughness=THREE.MathUtils.lerp(envLive.groundRoughness,t.groundRoughness,rate);
   envLive.groundMetalness=THREE.MathUtils.lerp(envLive.groundMetalness,t.groundMetalness,rate);
   envLive.plinth.lerp(tmpColor.set(t.plinthColor),rate);
   envLive.exposure=THREE.MathUtils.lerp(envLive.exposure,t.exposure,rate);
   envLive.envIntensity=THREE.MathUtils.lerp(envLive.envIntensity,t.envIntensity,rate);
   if(scene.background instanceof THREE.Color)scene.background.copy(envLive.background);
   hemi.color.copy(envLive.hemiSky);hemi.groundColor.copy(envLive.hemiGround);hemi.intensity=envLive.hemiIntensity*bp.light;
   key.color.copy(envLive.key);key.intensity=envLive.keyIntensity*bp.light;
   rim.color.copy(envLive.rim);rim.intensity=envLive.rimIntensity*bp.light;
   glow.color.copy(envLive.glow);glow.intensity=envLive.glowIntensity*bp.light;
   biomeScene.setGroundLook(envLive.ground,envLive.groundRoughness,envLive.groundMetalness);
   applyEnvIntensity(envLive.envIntensity*bp.env);
   stageMaterial.color.copy(envLive.plinth);
   renderer.toneMappingExposure=envLive.exposure;
   if(!envReady||particleMode!==t.particles)setParticleMode(t.particles);
   envReady=true;
  }
  envApi.current={apply(cfg){
   envTarget=cfg;
  }};
  envTarget=initialEnv;tickEnvironment(1);
  const airflow=createAirflow(scene, vehicle.airflow);
  airflowApi.current=airflow;
  if(latest.current.airflow)airflow.setEnabled(true);
  airflow.setWindSpeed(latest.current.windSpeed);
  // Drive: 4 hub pivots from vehicle.wheelCenters (do NOT guess from bbox).
  // Two asset layouts:
  //  A) separate wheel meshes (overview SU7) — attach each mesh to nearest hub
  //  B) one merged mesh (su7-detail Object_56) — split triangles by nearest hub first
  // Pivot.attach preserves world transform; we only rotate the pivot (axis from longAxis).
  const wheelAxis: 'x'|'z' = vehicle.airflow.longAxis==='x'?'z':'x';
  let wheelPivots:THREE.Group[]=[];
  let drivePivotsOn=false;
  let drivePhase=0;
  const pivotedPieces=new Set<THREE.Object3D>();
  function mountDoorHinges(){
   if(doorHingesMounted||!vehicle.openables.doors||!groups.doors)return;
   const byName=new Map<string,THREE.Object3D>();
   groups.doors.traverse(o=>{if(o.name)byName.set(o.name,o)});
   for(const piece of pieces)if(piece.part==='doors'&&piece.node.name)byName.set(piece.node.name,piece.node);
   const DOOR_SETS:string[][]=[
    ['Object_31','Object_32','Object_33','Object_34','Object_35','Object_36'],
    ['Object_38','Object_39','Object_40','Object_41','Object_42'],
    ['Object_44','Object_45','Object_46','Object_47','Object_48','Object_49'],
    ['Object_51','Object_52','Object_53','Object_54'],
   ];
   const WINDOW_NAMES=new Set(['Object_36','Object_49']); // glass only — not side mirror (33/46) or mirror cap (34/47)
   groups.doors.updateMatrixWorld(true);
   doorHinges=[];
   for(const names of DOOR_SETS){
    const meshes=names.map(n=>byName.get(n)).filter((o):o is THREE.Object3D=>!!o);
    if(meshes.length<2)continue;
    const box=new THREE.Box3();
    for(const m of meshes)box.expandByObject(m);
    const c=box.getCenter(new THREE.Vector3());
    // Conventional SU7: every door hinges at its FRONT edge (min Z; rear doors at B-pillar).
    const hingeZ=box.min.z;
    const pivot=new THREE.Group();
    pivot.name='door_hinge';
    const local=new THREE.Vector3(c.x,c.y,hingeZ);
    groups.doors.worldToLocal(local);
    pivot.position.copy(local);
    groups.doors.add(pivot);
    const windows:DoorHinge['windows']=[];
    for(const m of meshes){
     pivot.attach(m);
     pivotedPieces.add(m);
     if(WINDOW_NAMES.has(m.name))windows.push({node:m,homeY:m.position.y});
    }
    const swing=c.x<0?-1:1;
    doorHinges.push({pivot,sign:swing,windows});
   }
   for(const piece of pieces){
    if(pivotedPieces.has(piece.node))piece.home.copy(piece.node.position);
   }
   doorHingesMounted=true;
  }
  let mergedWheelSource:THREE.Mesh|null=null;
  let splitWheelMeshes:THREE.Mesh[]=[];
  function mountWheelPivots(){
   if(drivePivotsOn)return;
   groups.wheels.updateMatrixWorld(true);
   const meshes:THREE.Mesh[]=[];
   groups.wheels.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh)});
   const centers=vehicle.wheelCenters.map(c=>new THREE.Vector3(c[0],c[1],c[2]));
   wheelPivots=[];
   for(const center of centers){
    const pivot=new THREE.Group();
    pivot.name='wheel_hub';
    const local=groups.wheels.worldToLocal(center.clone());
    pivot.position.copy(local);
    groups.wheels.add(pivot);
    wheelPivots.push(pivot);
   }
   // Heuristic: a single high-poly mesh under wheels = merged 4-corner asset.
   const merged=meshes.length===1&&(meshes[0].geometry.getAttribute('position')?.count||0)>8000;
   if(merged){
    const source=meshes[0];
    source.updateWorldMatrix(true,false);
    groups.wheels.updateWorldMatrix(true,false);
    // Classify verts in world space; build geometries in groups.wheels local space.
    const toWheelsLocal=new THREE.Matrix4().copy(groups.wheels.matrixWorld).invert().multiply(source.matrixWorld);
    const pos=source.geometry.getAttribute('position') as THREE.BufferAttribute;
    const index=source.geometry.getIndex();
    const owner=new Uint8Array(pos.count);
    const wv=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
     wv.fromBufferAttribute(pos,i).applyMatrix4(source.matrixWorld);
     let best=0,bd=Infinity;
     for(let c=0;c<centers.length;c++){
      const d=centers[c].distanceToSquared(wv);
      if(d<bd){bd=d;best=c}
     }
     owner[i]=best;
    }
    const buckets:number[][]=[[],[],[],[]];
    const triCount=index?index.count/3:pos.count/3;
    for(let t=0;t<triCount;t++){
     const a=index?index.getX(t*3):t*3;
     const b=index?index.getX(t*3+1):t*3+1;
     const c=index?index.getX(t*3+2):t*3+2;
     // Majority of the three verts — more stable than first-vertex only.
     const o0=owner[a],o1=owner[b],o2=owner[c];
     const o=(o0===o1||o0===o2)?o0:(o1===o2?o1:o0);
     buckets[o].push(a,b,c);
    }
    const srcPos=pos;
    const srcNorm=source.geometry.getAttribute('normal');
    const srcUv=source.geometry.getAttribute('uv');
    const mat=Array.isArray(source.material)?source.material[0]:source.material;
    splitWheelMeshes=[];
    for(let w=0;w<4;w++){
     const inds=buckets[w];
     if(!inds.length)continue;
     const pArr=new Float32Array(inds.length*3);
     const nArr=srcNorm?new Float32Array(inds.length*3):null;
     const uArr=srcUv?new Float32Array(inds.length*2):null;
     const v=new THREE.Vector3();
     for(let k=0;k<inds.length;k++){
      const vi=inds[k];
      v.fromBufferAttribute(srcPos,vi).applyMatrix4(toWheelsLocal);
      pArr[k*3]=v.x;pArr[k*3+1]=v.y;pArr[k*3+2]=v.z;
      if(nArr&&srcNorm){
       // normal matrix: rotation-only from toWheelsLocal
       v.fromBufferAttribute(srcNorm,vi).transformDirection(toWheelsLocal);
       nArr[k*3]=v.x;nArr[k*3+1]=v.y;nArr[k*3+2]=v.z;
      }
      if(uArr&&srcUv){
       uArr[k*2]=srcUv.getX(vi);uArr[k*2+1]=srcUv.getY(vi);
      }
     }
     const g=new THREE.BufferGeometry();
     g.setAttribute('position',new THREE.BufferAttribute(pArr,3));
     if(nArr)g.setAttribute('normal',new THREE.BufferAttribute(nArr,3));
     if(uArr)g.setAttribute('uv',new THREE.BufferAttribute(uArr,2));
     const mesh=new THREE.Mesh(g,mat);
     mesh.name='wheel_split_'+w;
     mesh.castShadow=true;mesh.receiveShadow=true;
     groups.wheels.add(mesh);
     wheelPivots[w].attach(mesh);
     splitWheelMeshes.push(mesh);
    }
    source.visible=false;
    pivotedPieces.add(source);
    mergedWheelSource=source;
   }else{
    const box=new THREE.Box3();
    const c=new THREE.Vector3();
    const used=new Set<THREE.Object3D>();
    for(const m of meshes){
     if(used.has(m))continue;
     box.setFromObject(m);box.getCenter(c);
     let best=0,bd=Infinity;
     for(let i=0;i<centers.length;i++){
      const d=centers[i].distanceTo(c);
      if(d<bd){bd=d;best=i}
     }
     if(bd>0.5)continue;
     wheelPivots[best].attach(m);
     used.add(m);
     pivotedPieces.add(m);
    }
   }
   drivePivotsOn=true;
  }
  function unmountWheelPivots(){
   if(!drivePivotsOn)return;
   for(const mesh of splitWheelMeshes){
    mesh.geometry.dispose();
    mesh.removeFromParent();
   }
   splitWheelMeshes=[];
   if(mergedWheelSource){
    mergedWheelSource.visible=true;
    pivotedPieces.delete(mergedWheelSource);
    mergedWheelSource=null;
   }
   for(const pivot of wheelPivots){
    pivot.rotation.set(0,0,0);
    while(pivot.children.length){
     const child=pivot.children[0];
     groups.wheels.attach(child);
    }
    pivot.removeFromParent();
   }
   wheelPivots=[];
   drivePivotsOn=false;
   for(const piece of pieces)if(piece.part==='wheels')pivotedPieces.delete(piece.node);
  }
  let roadScroll=0;
  // Moving road dashes so "running" is obvious even if wheel spokes are dark.
  const roadGroup=new THREE.Group();roadGroup.visible=false;scene.add(roadGroup);
  const roadMat=new THREE.MeshBasicMaterial({color:0xc8d8e8,transparent:true,opacity:0.35});
  const roadDashes:THREE.Mesh[]=[];
  for(let i=0;i<24;i++){
   const dash=new THREE.Mesh(new THREE.BoxGeometry(vehicle.airflow.longAxis==='x'?1.2:0.18,0.02,vehicle.airflow.longAxis==='x'?0.18:1.2),roadMat);
   if(vehicle.airflow.longAxis==='x')dash.position.set(-14+i*1.4,-0.17,0);
   else dash.position.set(0,-0.17,-14+i*1.4);
   roadGroup.add(dash);roadDashes.push(dash);
  }
  const labelNodes=parts.map((p,i)=>{const b=document.createElement('button');b.className='scene-label';b.setAttribute('aria-label','Inspect '+p.name);b.innerHTML='<span>'+String(i+1).padStart(2,'0')+'</span><strong>'+p.name+'</strong>';b.addEventListener('click',()=>latest.current.onSelect(p.id));el.appendChild(b);return {b,id:p.id}});
  let viewWidth=1,viewHeight=1;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;viewWidth=w;viewHeight=h;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(readyRef.current){invalidated=true;framingTime=.8}};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const taps=new PointerTap();const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
  const onDown=(e:PointerEvent)=>{taps.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?10:5)};
  const onMove=(e:PointerEvent)=>{taps.move(e.pointerId,e.clientX,e.clientY)};
  const onCancel=(e:PointerEvent)=>{taps.cancel(e.pointerId)};
  const onUp=(e:PointerEvent)=>{if(!taps.up(e.pointerId,e.clientX,e.clientY))return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);if(markers.visible){let nearest=-1,nearestDistance=e.pointerType==='touch'?324:64;pieces.forEach((piece,i)=>{vector.copy(piece.center).add(piece.node.position).sub(piece.home).add(groups[piece.part].position).project(camera);const dx=(vector.x-pointer.x)*viewWidth/2,dy=(vector.y-pointer.y)*viewHeight/2,d=dx*dx+dy*dy;if(vector.z<1&&d<nearestDistance){nearest=i;nearestDistance=d}});if(nearest>=0){latest.current.onSelect(pieces[nearest].part);latest.current.onInspect(pieces[nearest].id);return}}
   const hits=raycaster.intersectObjects(Object.values(groups),true).filter(h=>{let o:THREE.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent}return true});if(hits[0]){latest.current.onSelect(hits[0].object.userData.part);latest.current.onInspect(hits[0].object.userData.component||'')}};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointercancel',onCancel);renderer.domElement.addEventListener('pointerup',onUp);
  const lost=(e:Event)=>{e.preventDefault();setError('The graphics connection was interrupted. Please reload the view.')};renderer.domElement.addEventListener('webglcontextlost',lost);
  let raf=0;let amount=latest.current.explode/100;const vector=new THREE.Vector3();let last=performance.now();
  let focusKey='';let previousExplosion=latest.current.explode;let framingTime=0;
  let invalidated=true,previousProps:Props|null=null,lastLabels=0,lastShadow=0;
  let labelsPending=false;let lastHighlighted='';const cameraPosition=new THREE.Vector3(),cameraQuaternion=new THREE.Quaternion();
  const homeTarget=new THREE.Vector3(0,.8,0),framingDirection=overviewDirection.clone();
  // Interior camera: driver eye, looking forward (nose is −Z).
  const interiorEye=new THREE.Vector3(0,1.12,0.62);
  const interiorLook=new THREE.Vector3(0,1.0,-1.4);
  let interiorActive=false;
  /**
   * Cabin-first interior (not a ghost car):
   * hide exterior shell / wheels / chassis; keep cabin + door cards at full strength
   * so su7-detail interior textures read as real trim. Overview SU7 only has a cabin block.
   */
  function applyInteriorVisibility(on:boolean){
   for(const {id} of parts){
    const g=groups[id];
    if(!g)continue;
    if(on){
     g.visible=!(id==='wheels'||id==='battery'||id==='drive'||id==='suspension');
    }else{
     g.visible=true;
    }
   }
   for(const piece of pieces){
    for(const m of piece.materials){
     if(!on){
      if(m.userData.baseTransparent!==undefined)m.transparent=m.userData.baseTransparent;
      if(m.userData.baseOpacity!==undefined)m.opacity=m.userData.baseOpacity;
      if(m.userData.baseDepthWrite!==undefined)m.depthWrite=m.userData.baseDepthWrite;
      continue;
     }
     if(m.userData.baseOpacity===undefined){
      m.userData.baseTransparent=m.transparent;
      m.userData.baseOpacity=m.opacity;
      m.userData.baseDepthWrite=m.depthWrite;
     }
     if(piece.part==='glass'){
      m.transparent=true;m.opacity=0.12;m.depthWrite=false;
     }else if(piece.part==='body'){
      m.transparent=true;m.opacity=0.2;m.depthWrite=false;
     }else{
      m.transparent=Boolean(m.userData.baseTransparent);
      m.opacity=Number(m.userData.baseOpacity??1);
      m.depthWrite=Boolean(m.userData.baseDepthWrite??true);
     }
    }
   }
   stage.visible=!on&&amount<.18;
   grid.visible=!on;
  }
  function fitView(immediate=false,dt=1/60){
   if(latest.current.isolated)return;
   // Interior: only snap on entry. After framingTime expires the user owns the camera.
   if(latest.current.interiorView){
    if(immediate||framingTime>0){
     const blend=immediate?1:1-Math.exp(-5*dt);
     controls.target.lerp(interiorLook,blend);
     camera.position.lerp(interiorEye,blend);
    }
    return;
   }
   const f=THREE.MathUtils.smoothstep(immediate?latest.current.explode/100:amount,.4,1);
   const target=homeTarget.clone().lerp(layoutCenter,f);
   const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
   const fullDistance=layout?Math.max(layout.height/(2*tangent),layout.width/(2*tangent*camera.aspect))*1.18+3:9;
   const assembledDistance=Math.max(10.5,7.5/camera.aspect);
   const distance=THREE.MathUtils.lerp(assembledDistance,fullDistance,f);
   const direction=immediate?overviewDirection:framingDirection.clone().lerp(overviewDirection,f).normalize();
   const blend=immediate?1:1-Math.exp(-8*dt);
   controls.target.lerp(target,blend);camera.position.lerp(target.addScaledVector(direction,distance),blend);
  }
  const stopFraming=()=>{framingTime=0};controls.addEventListener('start',stopFraming);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keys=new Set<string>();
  const onKeyDown=(e:KeyboardEvent)=>{
   if(!latest.current.interiorView)return;
   const k=e.key.toLowerCase();
   if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault()}
  };
  const onKeyUp=(e:KeyboardEvent)=>{keys.delete(e.key.toLowerCase())};
  window.addEventListener('keydown',onKeyDown);
  window.addEventListener('keyup',onKeyUp);
  function frame(now:number){raf=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
   const p=latest.current,propsChanged=!previousProps||p.selected!==previousProps.selected||p.focusedMesh!==previousProps.focusedMesh||p.isolated!==previousProps.isolated||p.labels!==previousProps.labels||p.autoRotate!==previousProps.autoRotate||p.season!==previousProps.season||p.weather!==previousProps.weather||p.airflow!==previousProps.airflow||p.driving!==previousProps.driving||p.driveSpeed!==previousProps.driveSpeed||p.interiorView!==previousProps.interiorView||p.doorsOpen!==previousProps.doorsOpen||p.windowsOpen!==previousProps.windowsOpen;
   biomeScene.update(dt,now*.001);const bparams=biomeScene.params();
   tickEnvironment(dt);
   if(particles)updateParticles(particles,dt,now*.001);
   airflow.setEnabled(p.airflow);
   airflow.setWindSpeed(p.windSpeed);
   airflow.update(dt,now*.001);
   // Keep drawing while particles/airflow animate even if the camera is still.
   const driveActive=p.driving&&amount<0.02&&!p.isolated&&!p.airflow;
   roadGroup.visible=driveActive;
   if(driveActive&&readyRef.current)mountWheelPivots();
   if(driveActive){
    drivePhase+=p.driveSpeed*90*dt;
    for(const pivot of wheelPivots){
     if(wheelAxis==='z')pivot.rotation.z=drivePhase;
     else pivot.rotation.x=drivePhase;
    }
    const travel=p.driveSpeed*18*dt;
    roadScroll+=travel;
    roadDashes.forEach((d)=>{
     if(vehicle.airflow.longAxis==='x'){
      d.position.x-=travel;
      if(d.position.x<-16)d.position.x+=24*1.4;
     }else{
      d.position.z-=travel;
      if(d.position.z<-16)d.position.z+=24*1.4;
     }
    });
    if(vehicle.airflow.longAxis==='x'){grid.position.x-=travel;if(grid.position.x<-2)grid.position.x+=2}
    else{grid.position.z-=travel;if(grid.position.z<-2)grid.position.z+=2}
    stage.visible=false;
   }else if(drivePivotsOn||drivePhase!==0){
    unmountWheelPivots();
    drivePhase=0;roadScroll=0;
   }
   // Interior cabin view: hide exterior shell, free-orbit camera inside the cabin.
   if(p.interiorView!==interiorActive){
    interiorActive=p.interiorView;
    applyInteriorVisibility(interiorActive);
    if(interiorActive){
     // Free look: right-drag/two-finger pan moves the eye; left-drag orbits; scroll zooms; WASD walks.
     controls.minDistance=.2;
     controls.maxDistance=4.5;
     controls.maxPolarAngle=Math.PI*.85;
     controls.minPolarAngle=Math.PI*.05;
     controls.enablePan=true;
     controls.screenSpacePanning=true;
     framingTime=1.0;
     framingDirection.copy(camera.position).sub(controls.target).normalize();
    }else{
     controls.minDistance=5;
     controls.maxDistance=180;
     controls.maxPolarAngle=Math.PI*.49;
     controls.minPolarAngle=.18;
     controls.enablePan=true;
     framingTime=1.2;
    }
    invalidated=true;
   }
   // Openables stay closed while driving / wind-tunnel / exploded / isolated.
   const canOpen=!driveActive&&!p.airflow&&amount<.05&&!p.isolated;
   const doorsAmt=canOpen?p.doorsOpen:0;
   const windowsAmt=canOpen?p.windowsOpen:0;
   // Hinges exist only while assembled. Explode unmounts them so door pieces follow the layout.
   if(amount>=.06&&doorHingesMounted)unmountDoorHinges();
   if(!doorHingesMounted&&amount<.05&&vehicle.openables.doors&&readyRef.current)mountDoorHinges();
   if(doorHingesMounted&&doorHinges.length){
    const ang=doorsAmt*Math.PI*0.42;
    for(const d of doorHinges){
     d.pivot.rotation.y=d.sign*ang;
     for(const w of d.windows)w.node.position.y=w.homeY-windowsAmt*0.28;
    }
   }
   const motionLive=Boolean(particles)||p.airflow||driveActive||p.interiorView||doorsAmt>0||windowsAmt>0;
   if(p.explode!==previousExplosion){previousExplosion=p.explode;framingTime=1.5;framingDirection.copy(camera.position).sub(controls.target).normalize()}
   const oldAmount=amount;amount=reduced?p.explode/100:THREE.MathUtils.damp(amount,p.explode/100,7,dt);if(Math.abs(amount-p.explode/100)<.0001)amount=p.explode/100;
   const moving=oldAmount!==amount,geometryChanged=moving||invalidated||propsChanged;
   const individual=THREE.MathUtils.smoothstep(amount,.4,1);
   if(scene.fog instanceof THREE.Fog){scene.fog.color.copy(envLive.fog);scene.fog.near=envLive.fogNear*bparams.fog+individual*384;scene.fog.far=envLive.fogFar*bparams.fog+individual*445;}
   framingTime=Math.max(0,framingTime-dt);if(framingTime>0)fitView(false,dt);
   if(p.interiorView&&keys.size&&!reduced){
    const speed=1.8*dt;
    const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();
    const move=new THREE.Vector3();
    if(keys.has('w')||keys.has('arrowup'))move.add(forward);
    if(keys.has('s')||keys.has('arrowdown'))move.sub(forward);
    if(keys.has('d')||keys.has('arrowright'))move.add(right);
    if(keys.has('a')||keys.has('arrowleft'))move.sub(right);
    if(move.lengthSq()>0){
     move.normalize().multiplyScalar(speed);
     camera.position.add(move);controls.target.add(move);
     stopFraming();
    }
   }
   controls.autoRotate=p.autoRotate&&!reduced&&!p.interiorView;controls.update();
   const cameraChanged=camera.position.distanceToSquared(cameraPosition)>1e-10||1-Math.abs(camera.quaternion.dot(cameraQuaternion))>1e-10;
   if(!geometryChanged&&!cameraChanged&&!motionLive&&!(labelsPending&&now-lastLabels>50))return;
   labelsPending=true;
   if(geometryChanged){
    const groundY=-.19-.85*amount-individual*(layout?.height||0)*.6;biomeScene.setGroundY(groundY);grid.position.y=groundY+.005;
    stage.visible=!p.interiorView&&amount<.18&&!p.isolated&&!driveActive&&bparams.stage>.02;stageMaterial.opacity=(1-THREE.MathUtils.smoothstep(amount,.02,.18))*bparams.stage;rimMaterial.opacity=stageMaterial.opacity;
    renderer.shadowMap.enabled=!p.interiorView&&individual<.05&&!p.isolated;biomeScene.setEnvironmentVisible(individual<.2&&!p.isolated);grid.visible=!p.interiorView&&individual<.2&&!p.isolated&&bparams.grid;
    parts.forEach(({id})=>{const g=groups[id],o=offsets[id];g.position.set(o[0]*amount*(1-individual),o[1]*amount*(1-individual),o[2]*amount*(1-individual));
     if(p.interiorView){
      // Cabin-first: exterior shell stays off every frame so explode logic cannot re-show it.
      g.visible=!(id==='wheels'||id==='battery'||id==='drive'||id==='suspension');
     }else{
      g.visible=!p.isolated||p.selected===id;
      if(['battery','drive','suspension'].includes(id))g.visible=g.visible&&(amount>.08||p.isolated)&&(individual<.98||p.isolated);
     }
    });
    const positions=markerGeometry.getAttribute('position') as THREE.BufferAttribute|undefined;
    pieces.forEach((piece,i)=>{
     // While the drive pivots are mounted these nodes are owned by a pivot: their local
     // position encodes the pivot offset (see pivotedPieces). Writing `home` here would
     // cancel that offset and fling the wheel off the car — so skip them until unmount.
     // ANY pivot-owned node (drive wheels OR door hinges) must not receive explosion home writes.
      const pivotManaged=pivotedPieces.has(piece.node);
     if(!pivotManaged)piece.node.position.copy(piece.home).addScaledVector(piece.spread,amount*(1-individual)).addScaledVector(piece.fullSpread,individual);
     piece.node.visible=!p.isolated||!p.focusedMesh||p.focusedMesh===piece.id;
     if(positions&&!pivotManaged){vector.copy(piece.center).add(piece.node.position).sub(piece.home).add(groups[piece.part].position);positions.setXYZ(i,vector.x,vector.y,vector.z)}
    });
    if(positions)positions.needsUpdate=true;
    markers.visible=!p.interiorView&&individual>.45&&!p.isolated&&!p.labels;
    markerMaterial.opacity=THREE.MathUtils.smoothstep(individual,.45,.9)*.75;
    if(p.focusedMesh!==lastHighlighted||invalidated){
     for(const piece of pieces)if(piece.id===lastHighlighted||piece.id===p.focusedMesh){
      for(const m of piece.materials){m.emissive.copy(m.userData.baseEmission);m.emissiveIntensity=m.userData.baseIntensity;if(piece.id===p.focusedMesh){m.emissive.set('#c1532f');m.emissiveIntensity=.23}}
     }
     lastHighlighted=p.focusedMesh;
    }
    if(renderer.shadowMap.enabled&&(!moving||now-lastShadow>80)){renderer.shadowMap.needsUpdate=true;lastShadow=now}
   }
   const nextFocus=p.isolated?(p.focusedMesh||p.selected):'';
   if(readyRef.current&&nextFocus!==focusKey){
    focusKey=nextFocus;
    if(nextFocus){
     const target=p.focusedMesh?pieces.find(x=>x.id===p.focusedMesh)?.node:groups[p.selected];
     if(target){scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(target);const center=bounds.getCenter(new THREE.Vector3());const extent=bounds.getSize(new THREE.Vector3()).length();const direction=camera.position.clone().sub(controls.target).normalize();controls.minDistance=.15;controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,Math.max(.4,extent*1.8));}
    }else{controls.minDistance=.15;fitView(true)}
    controls.update();
   }
   if(p.isolated&&readyRef.current&&geometryChanged){
    const target=p.focusedMesh?pieces.find(x=>x.id===p.focusedMesh)?.node:groups[p.selected];
    if(target){scene.updateMatrixWorld(true);const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());const movement=center.clone().sub(controls.target);camera.position.add(movement);controls.target.copy(center);controls.update()}
   }
   // Transform-only label updates avoid hundreds of layout writes on every frame.
   if(now-lastLabels>50||propsChanged||invalidated){
    lastLabels=now;labelsPending=false;
    labelNodes.forEach(({b,id})=>{const show=individual<.5&&readyRef.current&&p.labels&&(!['battery','drive','suspension'].includes(id)||amount>.08||p.isolated)&&(!p.isolated||p.selected===id);
     if(b.hidden===show)b.hidden=!show;if(!show)return;
     const a=anchors[id];vector.set(...a).add(groups[id].position).project(camera);b.style.display=vector.z<1?'flex':'none';b.classList.toggle('chosen',id===p.selected);
     b.style.transform=`translate3d(${(vector.x*.5+.5)*viewWidth}px,${(-vector.y*.5+.5)*viewHeight}px,0) translate(-12px,-50%)`;
    });
    pieceLabels.forEach(({b,id,part,center,spread,fullSpread})=>{
     const show=individual>.45&&(p.labels||id===p.focusedMesh)&&(!p.isolated||p.selected===part)&&(!p.isolated||!p.focusedMesh||p.focusedMesh===id);
     if(b.hidden===show)b.hidden=!show;if(!show)return;
     vector.copy(center).addScaledVector(spread,amount*(1-individual)).addScaledVector(fullSpread,individual).add(groups[part].position).project(camera);
     b.style.display=vector.z<1&&Math.abs(vector.x)<1&&Math.abs(vector.y)<1?'grid':'none';b.classList.toggle('chosen',p.focusedMesh===id);b.classList.add('numbered');
     b.style.transform=`translate3d(${(vector.x*.5+.5)*viewWidth}px,${(-vector.y*.5+.5)*viewHeight}px,0) translate(-50%,-50%)`;
    });
   }
   cameraPosition.copy(camera.position);cameraQuaternion.copy(camera.quaternion);previousProps=p;invalidated=false;
   renderer.render(scene,camera);
  }raf=requestAnimationFrame(frame);
  return()=>{cancelled=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);controls.removeEventListener('start',stopFraming);controls.dispose();markerGeometry.dispose();markerMaterial.dispose();engine.current=null;envApi.current=null;airflowApi.current=null;biomeApi.current=null;biomeScene.dispose();disposeParticles(particles);particles=null;airflow.dispose();labelNodes.forEach(x=>x.b.remove());pieceLabels.forEach(x=>x.b.remove());renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointercancel',onCancel);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});env.dispose();pmrem.dispose();room.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <><div ref={host} className="canvas-host" aria-label="Rotatable exploded 3D vehicle model"/>{(!ready||sceneryBusy)&&!error&&<div className="scene-loading"><span/>{ready?'Loading scenery…':getVehicle(props.vehicle).loadingText}</div>}{error&&<div className="scene-error"><h3>The 3D view needs a moment.</h3><p>{error}</p><button onClick={()=>location.reload()}>Reload the view</button></div>}</>;
});
export default VehicleScene;
