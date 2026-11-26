import trimesh,numpy as np,json,struct
D='/tmp/bp3d/assets/BodyParts3D_data/stl/'
PARTS=[('fem',24475,7000),('tib',24478,5500),('fib',24481,1600),('pat',24487,1400),
 ('rf',38929,1200),('vmed',38933,2200),('vlat',38931,2200),('vint',38935,1400),
 ('st',22359,700),('sm',22449,1200),('bfl',45889,1000),('bfs',45892,900),
 ('gm',45958,1500),('gl',45961,1300),('pop',22592,700),('itb',58777,600)]
S=1/30.
fem=trimesh.load(D+'FMA24475.stl');tib=trimesh.load(D+'FMA24478.stl')
fv=fem.vertices;distal=fv[fv[:,2]<fv[:,2].min()+35]
cx=distal[:,0].mean();cy=distal[:,1].mean();cz=fv[:,2].min()+8
def T(v):return np.c_[(v[:,0]-cx)*S,(v[:,2]-cz)*S,-(v[:,1]-cy)*S]
WIN=(-4.4,4.4)
out={};blob=b'';meta=[]
for key,fma,target in PARTS:
    m=trimesh.load(D+f'FMA{fma}.stl');m.merge_vertices()
    v=T(m.vertices);m=trimesh.Trimesh(v,m.faces,process=True)
    c=m.triangles_center;keep=(c[:,1]>WIN[0])&(c[:,1]<WIN[1])
    m.update_faces(keep);m.remove_unreferenced_vertices()
    if len(m.faces)==0: print('empty',key);continue
    if len(m.faces)>target:
        try:m=m.simplify_quadric_decimation(face_count=target)
        except Exception as e:print('simp fail',key,e)
    m.merge_vertices();m.remove_unreferenced_vertices()
    V=m.vertices;F=m.faces.astype(np.uint16)
    q=np.clip(np.round(V*2000),-32767,32767).astype(np.int16)
    meta.append({'k':key,'v':len(V),'f':len(F),'o':len(blob)})
    blob+=q.tobytes()+F.tobytes()
    out[key]=m
    print(key,len(V),len(F),V.min(0).round(2),V.max(0).round(2))
# landmarks
fv=out['fem'].vertices;tv=out['tib'].vertices;pv=out['pat'].vertices;bv=out['fib'].vertices
fmin=fv[:,1].min();tmax=tv[:,1].max()
d=fv[fv[:,1]<fmin+1.0]
L={}
L['pivot']=[float(d[:,0].mean()),float(fmin+.75),float(d[:,2].mean()-.15)]
top=tv[tv[:,1]>tmax-.35];med=top[top[:,0]<np.median(top[:,0])];lat=top[top[:,0]>=np.median(top[:,0])]
L['platM']=med.mean(0).tolist();L['platL']=lat.mean(0).tolist()
L['platMr']=float(np.percentile(np.linalg.norm(med[:,[0,2]]-med[:,[0,2]].mean(0),axis=1),80))
L['platLr']=float(np.percentile(np.linalg.norm(lat[:,[0,2]]-lat[:,[0,2]].mean(0),axis=1),80))
band=tv[(tv[:,1]<tmax-.7)&(tv[:,1]>tmax-2.6)];L['tub']=band[np.argmax(band[:,2])].tolist()
L['patSup']=pv[np.argmax(pv[:,1])].tolist();L['patInf']=pv[np.argmin(pv[:,1])].tolist();L['patC']=pv.mean(0).tolist()
a=fv[(fv[:,1]>3.0)&(fv[:,1]<3.6)];L['femAnt']=[float(a[:,0].mean()),3.3,float(a[:,2].max())];L['femPost']=[float(a[:,0].mean()),3.3,float(a[:,2].min())]
e=fv[(fv[:,1]>fmin+.6)&(fv[:,1]<fmin+1.7)];L['epiM']=e[np.argmin(e[:,0])].tolist();L['epiL']=e[np.argmax(e[:,0])].tolist()
L['fibHead']=bv[np.argmax(bv[:,1])].tolist()
m2=tv[(tv[:,1]<tmax-1.8)&(tv[:,1]>tmax-2.4)];L['tibMed']=m2[np.argmin(m2[:,0])].tolist()
L['tmax']=float(tmax);L['fmin']=float(fmin)
json.dump({'parts':meta,'L':L,'credit':'BodyParts3D, © 2008 Life Science Integrated Database Center, CC BY-SA 2.1 JP'},open('/tmp/knee/meta.json','w'))
hdr=json.dumps({'parts':meta,'L':L}).encode();hdr+=b' '*((4-len(hdr)%4)%4)
open('/tmp/knee/knee.bin','wb').write(struct.pack('<I',len(hdr))+hdr+blob)
print(json.dumps(L,indent=0)[:1500]);import os;print('size',os.path.getsize('/tmp/knee/knee.bin'))
