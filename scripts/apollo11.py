import bpy, math, os
from mathutils import Vector
from math import sin, cos, pi

OUT=os.path.abspath("output")
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=16
scene.render.resolution_x=540; scene.render.resolution_y=960; scene.render.resolution_percentage=100
scene.render.fps=24
scene.frame_start=1; scene.frame_end=960
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.world.color=(0.002,0.003,0.012)
scene.view_settings.view_transform='AgX'

def mat(name,color,metal=0,rough=.5,emission=None):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
 if emission:
  bs.inputs['Emission Color'].default_value=(*color,1); bs.inputs['Emission Strength'].default_value=emission
 return m
white=mat('Titanium white',(0.78,.81,.83),.45,.32); black=mat('Charcoal',(0.025,.035,.05),.4,.4)
gold=mat('Thermal gold',(.83,.48,.12),.65,.28); blue=mat('Earth ocean',(.012,.09,.35),.25,.3)
moonmat=mat('Moon regolith',(.34,.35,.38),0,.95); fire=mat('Rocket plume',(1,.23,.015),0,.3,4)
def uv(name,loc,scale,material,seg=32,rings=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc); o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material); return o
def cyl(name,loc,radius,depth,material,vertices=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc); o=bpy.context.object;o.name=name;o.data.materials.append(material);return o
def cone(name,loc,r1,r2,depth,material):
 bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r1,radius2=r2,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);return o
def text_obj(body,loc,size,material):
 cu=bpy.data.curves.new('Typography','FONT');cu.body=body;cu.size=size;cu.extrude=.002
 ob=bpy.data.objects.new(body,cu);scene.collection.objects.link(ob);ob.location=loc;ob.data.materials.append(material);return ob
def track(obj,frame,loc):
 obj.location=loc;obj.keyframe_insert(data_path='location',frame=frame)
def point(obj,loc): obj.rotation_euler=(Vector(loc)-obj.location).to_track_quat('-Z','Y').to_euler()
def camera(loc,target,lens=45):
 bpy.ops.object.camera_add(location=loc); c=bpy.context.object;c.data.lens=lens;point(c,target);scene.camera=c;return c
def light(loc,power,color,size=5):
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.color=color;l.data.shape='DISK';l.data.size=size;point(l,(0,0,0))
def starfield():
 for i in range(180):
  x=((i*73)%101)/50-1; y=((i*37)%101)/50-1; z=-5-(i%7)*.2
  uv('Star',(x*8,y*13,z),(.012,.012,.012),mat('star'+str(i),(0.6+.4*(i%3)/3,0.7,1),0,.5,2),8,6)
def title(main,sub,frame):
 t=text_obj(main,(-3.7,5.5,-1),.48,white);t.keyframe_insert(data_path='location',frame=frame)
 s=text_obj(sub,(-3.7,4.85,-1),.19,gold);s.keyframe_insert(data_path='location',frame=frame)
# cinematic light
light((5,7,8),1700,(.68,.78,1),7);light((-6,-1,4),700,(1,.35,.12),5)
starfield()
# Saturn V staged model vertical axis Z, centered
rocket_parts=[]
body=cyl('Saturn V first stage',(0,0,0),.55,3.5,white,48)
rocket_parts.append(body)
for z,r,h,m in [(2.0,.42,1.0,white),(2.75,.31,.65,black),(3.3,.25,.55,white),(3.72,.19,.3,gold)]:
 rocket_parts.append(cyl('Rocket stage',(0,0,z),r,h,m,40))
rocket_parts.append(cone('Nose',(0,0,4.05),.2,0,.55,white))
for a in range(4):
 ang=a*pi/2
 fin=cone('Stabilizer',(cos(ang)*.52,sin(ang)*.52,-1.35),.22,.04,.95,black);fin.rotation_euler[1]=.5*cos(ang);fin.rotation_euler[0]=.5*sin(ang)
for x in [-.23,.23]:
 for y in [-.23,.23]: rocket_parts.append(cyl('Engine bell',(x,y,-1.9),.12,.55,black,20))
plume=cone('Flame',(0,0,-2.65),.35,.06,1.4,fire)
# camera shot 1
cam=camera((7,-12,4),(0,0,0),48)
for f,loc in [(1,(0,0,-3)),(220,(0,0,1.3))]: track(body,f,loc)
for ob in rocket_parts[1:]:
 for f in (1,220): ob.keyframe_insert(data_path='location',frame=f)
# animate rocket entire assembly as parent
root=bpy.data.objects.new('Launch trajectory',None);scene.collection.objects.link(root)
for ob in rocket_parts+[plume]:
 ob.parent=root
for f,z in [(1,-1.5),(220,5.5),(330,18)]:
 root.location=(0,0,z);root.keyframe_insert(data_path='location',frame=f)
plume.scale=(1,1,1.2);plume.keyframe_insert(data_path='scale',frame=1);plume.scale=(.2,.2,.2);plume.keyframe_insert(data_path='scale',frame=240)
# scene transition camera move and Earth reveal
earth=uv('Earth',(0,0,-8),(4.2,4.2,4.2),blue,64,40)
# continents stylized patches
for i in range(14):
 a=i*2.4; p=uv('Cloud and land',(3.7*cos(a),3.7*sin(a),-8+1.4*sin(i*4)),(.45,.22,.07),mat('Land'+str(i),(.12,.32,.18)),16,10);p.rotation_euler[2]=a
cam.location=(9,-13,5);cam.keyframe_insert(data_path='location',frame=1)
cam.location=(6,-10,4);cam.keyframe_insert(data_path='location',frame=300)
cam.location=(0,-17,3);cam.keyframe_insert(data_path='location',frame=480)
# moon near
moon=uv('Moon',(0,0,-12),(5,5,5),moonmat,64,40)
for i in range(24):
 a=i*2.399; r=4.7+0.2*sin(i*3)
 crater=uv('Crater',(r*cos(a),r*sin(a),-12+1.1*sin(i)),(.32,.24,.08),mat('Crater shade'+str(i),(.18,.19,.21)),16,8)
# lander assembly
lander_root=bpy.data.objects.new('Eagle lunar module',None);scene.collection.objects.link(lander_root)
lm=cyl('Descent stage',(0,0,0),.72,.42,gold,6);lm.parent=lander_root
for a in range(4):
 ang=a*pi/2
 leg=cyl('Landing strut',(cos(ang)*.65,sin(ang)*.65,-.65),.045,1.35,white,12);leg.rotation_euler[1]=.55*cos(ang);leg.rotation_euler[0]=-.55*sin(ang);leg.parent=lander_root
 foot=uv('Footpad',(cos(ang)*1.05,sin(ang)*1.05,-1.28),(.22,.22,.07),white,12,8);foot.parent=lander_root
 cabin=uv('Ascent cabin',(0,0,.65),(.55,.55,.55),gold,24,16);cabin.parent=lander_root
 for a in range(3):
  w=cyl('Window',(cos(a*2*pi/3)*.48,sin(a*2*pi/3)*.48,.75),.13,.035,black,16);w.parent=lander_root
for f,z in [(481,8),(660,1.4),(820,1.4),(960,1.4)]:
 lander_root.location=(0,0,z);lander_root.keyframe_insert(data_path='location',frame=f)
# lunar surface
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-13.45));ground=bpy.context.object;ground.data.materials.append(moonmat)
for i in range(50):
 a=i*2.4;r=2+(i%9)*.6
 uv('Lunar rock',(r*cos(a),r*sin(a),-13.25),(.12+(i%3)*.06,.1,.08),moonmat,12,8)
# flag planted beside lander
pole=cyl('Flag pole',(2,0,-12.2),.025,2.2,white,12)
bpy.ops.mesh.primitive_plane_add(size=1, location=(2.45,0,-11.35));flag=bpy.context.object;flag.scale=(.8,.48,1);flag.data.materials.append(mat('US flag red',(0.65,.04,.05)))
# text overlays
for fr,head,sub in [(1,'АПОЛЛОН-11','ПУТЬ К ЛУНЕ · 1969'),(260,'ОДИН МАЛЕНЬКИЙ ШАГ','20 ИЮЛЯ 1969'),(700,'ЧЕЛОВЕЧЕСТВО НА ЛУНЕ','МИССИЯ, ИЗМЕНИВШАЯ ИСТОРИЮ')]:
 title(head,sub,fr)
# camera focus on lander toward end
cam.location=(10,-16,5);cam.keyframe_insert(data_path='location',frame=480)
cam.location=(8,-12,-8);cam.keyframe_insert(data_path='location',frame=960)
point(cam,(0,0,-10))
for f in (1,240,480,720,960): cam.keyframe_insert(data_path='rotation_euler',frame=f)
scene.render.filepath=os.path.join(OUT,'frame_')
scene.frame_set(1)
# linear interpolation
for ob in scene.objects:
 if ob.animation_data and ob.animation_data.action:
  for fc in ob.animation_data.action.fcurves:
   for kp in fc.keyframe_points: kp.interpolation='BEZIER'
bpy.ops.render.render(animation=True)
