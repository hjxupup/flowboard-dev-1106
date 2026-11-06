import {useCallback,useEffect,useMemo,useState} from 'react';
import {DndContext,DragEndEvent,DragOverlay,DragStartEvent,PointerSensor,KeyboardSensor,useSensor,useSensors,useDroppable,closestCorners} from '@dnd-kit/core';
import {SortableContext,useSortable,sortableKeyboardCoordinates,verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {Activity,AlertCircle,ArrowRight,CalendarDays,Check,CheckCircle2,ChevronDown,ClipboardList,Clock3,Filter,GripVertical,LayoutDashboard,LoaderCircle,MessageCircle,Plus,Search,Send,Settings2,SlidersHorizontal,Sparkles,Trash2,X,FolderClosed,FolderOpen,ChevronLeft,ChevronRight,Code2,Bug,Palette,FlaskConical,Layers3,Play,Hourglass,Circle} from 'lucide-react';
import {format,formatDistanceToNow,differenceInCalendarDays,parseISO,isPast,isToday,isTomorrow,addDays,addMonths,isSameDay,isSameMonth,startOfMonth,startOfWeek} from 'date-fns';
import {supabase} from './lib/supabase';
import {columnMeta,Comment,Priority,Status,statuses,Task,TaskCategory} from './lib/types';

type TaskInput={title:string;description:string;priority:Priority;due_date:string;status:Status;category:TaskCategory};
const emptyInput=(status:Status='todo'):TaskInput=>({title:'',description:'',priority:'normal',due_date:'',status,category:'general'});
const categoryOptions=[
 {value:'general' as const,label:'General',Icon:Layers3},
 {value:'feature' as const,label:'Feature',Icon:Code2},
 {value:'bug' as const,label:'Bug',Icon:Bug},
 {value:'design' as const,label:'Design',Icon:Palette},
 {value:'research' as const,label:'Research',Icon:FlaskConical}
];
const priorityOptions=[
 {value:'low' as const,label:'Low',subtitle:'Not urgent'},
 {value:'normal' as const,label:'Medium',subtitle:'Standard'},
 {value:'high' as const,label:'High',subtitle:'Important'}
];
function dueLabel(value:string){const d=parseISO(value);if(isToday(d))return 'Today';if(isTomorrow(d))return 'Tomorrow';return format(d,'MMM d');}
function isOverdue(t:Task){return Boolean(t.due_date && t.status!=='done' && isPast(parseISO(t.due_date+'T23:59:59')));}
function TaskCard({task,overlay=false,onOpen,reviewActions}:{task:Task;overlay?:boolean;onOpen?:(t:Task)=>void;reviewActions?:React.ReactNode}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id,disabled:overlay});
 return <article ref={overlay?undefined:setNodeRef} className={'task-card'+(isDragging?' dragging':'')+(overlay?' overlay':'')} style={overlay?undefined:{transform:CSS.Transform.toString(transform),transition}} onClick={()=>!isDragging&&onOpen?.(task)}>
  <div className="card-top"><span className="card-tags"><span className={'task-category-chip category-'+(task.category||'general')}>{categoryOptions.find(c=>c.value===(task.category||'general'))?.label||'General'}</span><span className={'priority-pill '+task.priority}><span className="priority-dot"/>{task.priority==='normal'?'Medium':task.priority[0].toUpperCase()+task.priority.slice(1)}</span></span><button type="button" className="drag-handle" aria-label={'Drag '+task.title} {...(overlay?{}:{...attributes,...listeners})} onClick={e=>e.stopPropagation()}><GripVertical size={16}/></button></div>
  <h3>{task.title}</h3>{task.description&&<p className="card-description">{task.description}</p>}
  <div className="card-footer"><span className={'due-label'+(isOverdue(task)?' overdue':'')}>{task.due_date?<><CalendarDays size={13}/>{dueLabel(task.due_date)}</>:<><Clock3 size={13}/>No due date</>}</span><span className="card-avatar" title="My task">ME</span></div>
  {reviewActions}
 </article>;
}
function bubbleDeadline(task: Task) {
 if (!task.due_date) return {tone: 'unset', label: 'No due date'};
 const days = differenceInCalendarDays(parseISO(task.due_date), new Date());
 if (days < 0) return {tone: 'overdue', label: 'Overdue'};
 if (days === 0) return {tone: 'today', label: 'Due today'};
 if (days === 1) return {tone: 'soon', label: 'Due tomorrow'};
 return {tone: days <= 3 ? 'soon' : 'later', label: `Due in ${days} days`};
}

function BubbleTask({task,onOpen}:{task:Task;onOpen:(t:Task)=>void}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id});
 const deadline = bubbleDeadline(task);
 return <div ref={setNodeRef} className={'bubble-slot '+task.priority+(isDragging?' dragging':'')} style={{transform:CSS.Transform.toString(transform),transition}}>
  <button type="button" className="task-bubble" data-deadline={deadline.tone} title={task.title+' — drag to change status'} onClick={()=>onOpen(task)} {...attributes} {...listeners}>
   <span className="bubble-title">{task.title}</span><span className="bubble-priority">{deadline.label}</span>
  </button>
 </div>;
}
function DeadlineTask({task,onOpen}:{task:Task;onOpen:(t:Task)=>void}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id});
 const deadline = bubbleDeadline(task);
 return <article ref={setNodeRef} className={'deadline-task'+(isDragging?' dragging':'')} style={{transform:CSS.Transform.toString(transform),transition}}>
  <div className="deadline-top"><button className="deadline-title" onClick={()=>onOpen(task)}>{task.title}</button><button className="deadline-grip" {...attributes} {...listeners} aria-label={'Drag '+task.title}><GripVertical size={16}/></button></div>
  {task.description && <p className="deadline-description">{task.description}</p>}
  <div className="deadline-meta">
   <span className="deadline-badge" data-deadline={deadline.tone}>{deadline.label}</span>
   <span>{task.priority} priority</span>
  </div>
 </article>;
}
function ArchiveTask({task,onOpen}:{task:Task;onOpen:(t:Task)=>void}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id});
 return <div ref={setNodeRef} className={'archive-file'+(isDragging?' dragging':'')} style={{transform:CSS.Transform.toString(transform),transition}}><button onClick={()=>onOpen(task)}><CheckCircle2 size={15}/><span>{task.title}</span></button><button className="archive-grip" {...attributes} {...listeners} aria-label={'Drag '+task.title}><GripVertical size={15}/></button></div>;
}
const statusIcons={todo:Circle,in_progress:Play,in_review:Hourglass,done:Check};

function LivingColumn({status,tasks,onOpen,onAdd,renderReviewActions}:{status:Status;tasks:Task[];onOpen:(t:Task)=>void;onAdd:(s:Status)=>void;renderReviewActions:(task:Task)=>React.ReactNode}){
 const {setNodeRef,isOver}=useDroppable({id:status});const [open,setOpen]=useState(true);const meta=columnMeta[status];const Icon=statusIcons[status];
 return <section ref={setNodeRef} className={'living-column living-'+status+(isOver?' over':'')}>
  <header className="living-header"><div><span className="status-orb"><Icon size={20}/></span><div><h2>{meta.title} <span className="column-count">{tasks.length}</span></h2><p>{meta.hint}</p></div></div><button onClick={()=>onAdd(status)} aria-label={'Add task to '+meta.title}><Plus size={17}/></button></header>
  <SortableContext items={tasks.map(t=>t.id)} strategy={verticalListSortingStrategy}>
   {status==='todo'?<div className="bubble-field">{tasks.map(t=><BubbleTask key={t.id} task={t} onOpen={onOpen}/>)}{!tasks.length&&<p className="living-empty">New ideas float here.</p>}</div>:
    status==='in_progress'?<div className="deadline-list">{tasks.map(t=><DeadlineTask key={t.id} task={t} onOpen={onOpen}/>)}{!tasks.length&&<p className="living-empty">Nothing in progress yet.</p>}</div>:
    status==='done'?<div className="archive-wrap"><button className="archive-folder" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?<FolderOpen size={43}/>:<FolderClosed size={43}/>}<span><strong>Task Archive</strong><small>{tasks.length} archived task{tasks.length===1?'':'s'} · click to {open?'close':'open'}</small></span><ChevronDown size={18} className={open?'':'folder-closed'}/></button>{open&&<div className="archive-list">{tasks.map(t=><ArchiveTask key={t.id} task={t} onOpen={onOpen}/>)}{!tasks.length&&<p className="living-empty">Your completed tasks will be filed here.</p>}</div>}</div>:
    <div className="review-list">{tasks.map(t=><TaskCard key={t.id} task={t} onOpen={onOpen} reviewActions={renderReviewActions(t)}/>)}{!tasks.length&&<p className="living-empty">Ready for review? Drop it here.</p>}</div>}
  </SortableContext>
 </section>;
}
function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[onClose]);return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-panel" role="dialog" aria-modal="true">{children}</div></div>}
function TaskForm({initial,onSubmit,onCancel,saving}:{initial:TaskInput;onSubmit:(data:TaskInput)=>Promise<void>;onCancel:()=>void;saving:boolean}){
 const [form,setForm]=useState(initial);
 const [calendarOpen,setCalendarOpen]=useState(false);
 const [month,setMonth]=useState<Date>(()=>initial.due_date?parseISO(initial.due_date):new Date());
 const update=<K extends keyof TaskInput>(key:K,value:TaskInput[K])=>setForm(f=>({...f,[key]:value}));
 const calendarDays=useMemo(()=>{
  const first=startOfWeek(startOfMonth(month),{weekStartsOn:0});
  return Array.from({length:42},(_,i)=>addDays(first,i));
 },[month]);
 const selectedDay=form.due_date?parseISO(form.due_date):null;
 const selectDay=(day:Date)=>{update('due_date',format(day,'yyyy-MM-dd'));setMonth(day);setCalendarOpen(false)};
 return <form className="flow-task-form" onSubmit={e=>{e.preventDefault();if(form.title.trim())void onSubmit({...form,title:form.title.trim()})}}>
  <div className="form-grid">
   <label className="field full">Task title
    <input autoFocus required maxLength={200} placeholder="What needs to get done?" value={form.title} onChange={e=>update('title',e.target.value)}/>
   </label>
   <fieldset className="choice-field field full">
    <legend>Task category</legend>
    <div className="category-choices" role="group" aria-label="Task category">
     {categoryOptions.map(({value,label,Icon})=><button key={value} type="button" aria-pressed={form.category===value}
      className={'category-choice category-'+value+(form.category===value?' selected':'')}
      onClick={()=>update('category',value)}><Icon size={18}/><span>{label}</span></button>)}
    </div>
   </fieldset>
   <label className="field full">Description
    <textarea rows={3} maxLength={5000} placeholder="Add some context (optional)" value={form.description} onChange={e=>update('description',e.target.value)}/>
   </label>
   <fieldset className="choice-field field full">
    <legend>Status</legend>
    <div className="status-choices" role="group" aria-label="Task status">
     {statuses.map(status=><button type="button" key={status} aria-pressed={form.status===status}
      className={'status-choice status-'+status+(form.status===status?' selected':'')}
      onClick={()=>update('status',status)}><span className="choice-status-dot" style={{background:columnMeta[status].dot}}/>{columnMeta[status].title}</button>)}
    </div>
   </fieldset>
   <fieldset className="choice-field field full">
    <legend>Priority</legend>
    <div className="priority-choices" role="group" aria-label="Task priority">
     {priorityOptions.map(p=><button type="button" key={p.value} aria-pressed={form.priority===p.value}
      className={'priority-choice priority-'+p.value+(form.priority===p.value?' selected':'')}
      onClick={()=>update('priority',p.value)}><span className="choice-priority-dot"/><span><strong>{p.label}</strong><small>{p.subtitle}</small></span></button>)}
    </div>
   </fieldset>
   <div className="field full date-choice-field">
    <span id="flow-due-label">Due date</span>
    <button type="button" className={'date-trigger'+(calendarOpen?' open':'')} aria-labelledby="flow-due-label" aria-expanded={calendarOpen}
     onClick={()=>setCalendarOpen(o=>!o)}><CalendarDays size={19}/><span>{selectedDay?format(selectedDay,'EEEE, MMMM d, yyyy'):'Choose a due date'}</span><ChevronDown size={17}/></button>
    {calendarOpen&&<div className="flow-calendar" aria-label="Choose due date">
     <div className="calendar-heading"><strong>{format(month,'MMMM yyyy')}</strong><div>
      <button type="button" aria-label="Previous month" onClick={()=>setMonth(m=>addMonths(m,-1))}><ChevronLeft size={19}/></button>
      <button type="button" aria-label="Next month" onClick={()=>setMonth(m=>addMonths(m,1))}><ChevronRight size={19}/></button>
     </div></div>
     <div className="calendar-grid calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d}>{d}</span>)}</div>
     <div className="calendar-grid calendar-days">{calendarDays.map(d=><button type="button" key={format(d,'yyyy-MM-dd')}
       title={format(d,'EEEE, MMMM d, yyyy')} aria-label={format(d,'EEEE, MMMM d, yyyy')} aria-pressed={!!selectedDay&&isSameDay(d,selectedDay)}
       className={(isSameMonth(d,month)?'':'outside-month ')+(isToday(d)?'today ':'')+(selectedDay&&isSameDay(d,selectedDay)?'selected':'')}
       onClick={()=>selectDay(d)}>{format(d,'d')}</button>)}</div>
     <div className="calendar-footer"><button type="button" onClick={()=>selectDay(new Date())}>Today</button><button type="button" onClick={()=>{update('due_date','');setCalendarOpen(false)}}>Clear date</button></div>
    </div>}
   </div>
  </div>
  <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button>
   <button type="submit" className="primary-btn" disabled={saving||!form.title.trim()}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}Save task</button></div>
 </form>
}
export default function App(){
 const [userId,setUserId]=useState<string|null>(null),[tasks,setTasks]=useState<Task[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[priorityFilter,setPriorityFilter]=useState('all'),[dueFilter,setDueFilter]=useState('all'),[view,setView]=useState<'board'|'mytasks'>('board');
 const [creating,setCreating]=useState<Status|null>(null),[selected,setSelected]=useState<Task|null>(null),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false);
 const [comments,setComments]=useState<Comment[]>([]),[commentText,setCommentText]=useState(''),[commentsLoading,setCommentsLoading]=useState(false),[activeId,setActiveId]=useState<string|null>(null);
 const loadTasks=useCallback(async()=>{if(!supabase)return;const {data,error}=await supabase.from('tasks').select('*').order('position',{ascending:true}).order('created_at',{ascending:true});if(error)throw error;setTasks((data||[]) as Task[])},[]);
 useEffect(()=>{let live=true;(async()=>{if(!supabase){if(live){setError('This workspace is unavailable because its database connection is not configured.');setLoading(false)}return}try{const {data:{session},error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;let id=session?.user.id;if(!id){const {data,error:authError}=await supabase.auth.signInAnonymously();if(authError)throw authError;id=data.user?.id}if(!id)throw new Error('Unable to start a guest session');if(!live)return;setUserId(id);await loadTasks()}catch(e){if(live)setError((e as Error).message)}finally{if(live)setLoading(false)}})();return()=>{live=false}},[loadTasks]);
 useEffect(()=>{if(!selected||!supabase)return;let live=true;setCommentsLoading(true);setComments([]);supabase.from('comments').select('*').eq('task_id',selected.id).order('created_at',{ascending:true}).then(({data,error})=>{if(live){if(error)setError(error.message);else setComments((data||[]) as Comment[]);setCommentsLoading(false)}});return()=>{live=false}},[selected?.id]);
 const visible=useMemo(()=>tasks.filter(t=>{if(search&&!(`${t.title} ${t.description||''}`.toLowerCase().includes(search.toLowerCase())))return false;if(priorityFilter!=='all'&&t.priority!==priorityFilter)return false;if(dueFilter==='overdue'&&!isOverdue(t))return false;if(dueFilter==='upcoming'&&(!t.due_date||isOverdue(t)||t.status==='done'))return false;return true}),[tasks,search,priorityFilter,dueFilter]);
 const isHub=view==='board';
 const counts=useMemo(()=>({total:tasks.length,inReview:tasks.filter(t=>t.status==='in_review').length,completed:tasks.filter(t=>t.status==='done').length,inProgress:tasks.filter(t=>t.status==='in_progress').length,overdue:tasks.filter(isOverdue).length}),[tasks]);
 const toast=(message:string)=>{setNotice(message);setError('')};
 const createTask=async(data:TaskInput)=>{if(!supabase||!userId)return;setSaving(true);try{const payload={...data,description:data.description||null,due_date:data.due_date||null,user_id:userId,position:Date.now()};const {data:created,error}=await supabase.from('tasks').insert(payload).select().single();if(error)throw error;setTasks(prev=>[...prev,created as Task]);setCreating(null);toast('Task created successfully')}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 const updateTask=async(data:TaskInput)=>{if(!supabase||!selected)return;setSaving(true);try{const {data:updated,error}=await supabase.from('tasks').update({...data,description:data.description||null,due_date:data.due_date||null}).eq('id',selected.id).select().single();if(error)throw error;setTasks(prev=>prev.map(t=>t.id===selected.id?updated as Task:t));setSelected(updated as Task);setEditing(false);toast('Task updated')}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 const deleteTask=async()=>{if(!supabase||!selected||!window.confirm('Delete this task and all its comments?'))return;setSaving(true);try{const {error}=await supabase.from('tasks').delete().eq('id',selected.id);if(error)throw error;setTasks(prev=>prev.filter(t=>t.id!==selected.id));setSelected(null);toast('Task deleted')}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 const sendComment=async()=>{if(!supabase||!userId||!selected||!commentText.trim())return;setSaving(true);try{const {data,error}=await supabase.from('comments').insert({task_id:selected.id,user_id:userId,body:commentText.trim()}).select().single();if(error)throw error;setComments(prev=>[...prev,data as Comment]);setCommentText('')}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 const moveTask=async(id:string,status:Status,position:number)=>{if(!supabase)return;const before=tasks;setTasks(prev=>prev.map(t=>t.id===id?{...t,status,position}:t));const {error}=await supabase.from('tasks').update({status,position}).eq('id',id);if(error){setTasks(before);setError('Could not move task: '+error.message)}};
 const [returningTask, setReturningTask] = useState<Task | null>(null);
 const [reviewNote, setReviewNote] = useState('');
 const [reviewBusy, setReviewBusy] = useState(false);
 const [reviewError, setReviewError] = useState('');

 const submitReview = async (task: Task, note: string | null) => {
  if (!supabase || reviewBusy) return;
  setReviewBusy(true);
  setReviewError('');
  try {
   const {data, error} = await supabase.rpc('review_task', {
    task_id: task.id,
    feedback: note,
   });
   if (error) throw error;
   setTasks(prev => prev.map(item => item.id === task.id ? data as Task : item));
   setReturningTask(null);
   toast(note === null ? 'Task approved' : 'Changes requested');
  } catch (error) {
   const message = (error as Error).message;
   if (note === null) setError(message);
   else setReviewError(message);
  } finally {
   setReviewBusy(false);
  }
 };

 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:7}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 const onDragEnd=({active,over}:DragEndEvent)=>{setActiveId(null);if(!over)return;const moving=tasks.find(t=>t.id===active.id);if(!moving)return;const target=tasks.find(t=>t.id===over.id);const newStatus=target?.status??(statuses.includes(over.id as Status)?over.id as Status:moving.status);const siblings=tasks.filter(t=>t.status===newStatus&&t.id!==moving.id).sort((a,b)=>a.position-b.position);let index=target?siblings.findIndex(t=>t.id===target.id):siblings.length;if(index<0)index=siblings.length;const left=siblings[index-1]?.position,right=siblings[index]?.position;let position=left===undefined?(right===undefined?Date.now():right-1):right===undefined?left+1:(left+right)/2;if(!Number.isFinite(position)||position===left||position===right)position=Date.now();if(newStatus!==moving.status||position!==moving.position)void moveTask(moving.id,newStatus,position)};
 const closeSelected=()=>{setSelected(null);setEditing(false);setCommentText('')};
 const activeTask=tasks.find(t=>t.id===activeId);
 return <div className={isHub?'app-shell hub-shell':'app-shell'}><aside className="sidebar"><div className="brand"><div className="brand-icon"><LayoutDashboard size={20}/></div><span>flowboard<span className="brand-period">.</span></span></div><div className="workspace-picker"><div className="workspace-avatar">W</div><div><strong>My workspace</strong><small>Personal space</small></div><ChevronDown size={15}/></div><div className="sidebar-section-label">WORKSPACE</div><nav className="nav"><button className={view==='board'?'active':''} aria-label="Board" onClick={()=>setView('board')}><LayoutDashboard size={17}/>Board</button><button className={view==='mytasks'?'active':''} aria-label="All tasks" onClick={()=>setView('mytasks')}><ClipboardList size={17}/>All tasks<span className="nav-count">{counts.total}</span></button></nav><div className="sidebar-section-label projects-label">YOUR BOARD</div><div className="project-link"><span className="project-emoji">✦</span>Product workspace</div><div className="sidebar-bottom"><div className="sidebar-tip"><Sparkles size={18}/><strong>Make progress, beautifully.</strong><p>Keep everything in one place and stay in your flow.</p></div><div className="profile"><div className="profile-avatar">G</div><div><strong>Guest workspace</strong><small>{userId?'Private & secure':'Connecting...'}</small></div><Settings2 size={16}/></div></div></aside>
 <main className="main"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{view==='board'?'Board':'All tasks'}</strong></div><div className="top-actions"><span className="guest-indicator"><span/>Guest session</span><div className="header-avatar">G</div></div></header><div className="content"><div className="page-heading"><div><div className="eyebrow"><Sparkles size={14}/> YOUR PRODUCTIVITY SPACE</div><h1>{view==='board'?'Project board':'All tasks'} <span className="heading-spark">✳</span></h1><p>Organize your work, find your focus, and keep things moving.</p></div><button className="primary-btn create-main" onClick={()=>setCreating('todo')} disabled={!userId}><Plus size={17}/>New task</button></div>
 <div className="stats-grid"><div className="stat"><div className="stat-icon blue"><ClipboardList size={19}/></div><div><span>Total tasks</span><strong>{counts.total}</strong></div></div><div className="stat"><div className="stat-icon purple"><Activity size={19}/></div><div><span>In progress</span><strong>{counts.inProgress}</strong></div></div><div className="stat"><div className="stat-icon green"><CheckCircle2 size={19}/></div><div><span>Completed</span><strong>{counts.completed}</strong></div></div><div className="stat"><div className="stat-icon amber"><AlertCircle size={19}/></div><div><span>Overdue</span><strong>{counts.overdue}</strong></div></div></div>
 <div className="board-toolbar"><div className="board-title"><h2>{view==='board'?'Board overview':'Task directory'}</h2><span className="results-count">{visible.length} tasks</span></div><div className="filters"><div className="search-field"><Search size={16}/><input aria-label="Search tasks" placeholder="Search tasks..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={14}/></button>}</div><label className="filter-select"><SlidersHorizontal size={15}/><select aria-label="Filter priority" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="normal">Medium</option><option value="low">Low</option></select><ChevronDown size={13}/></label><label className="filter-select"><Filter size={15}/><select aria-label="Filter due date" value={dueFilter} onChange={e=>setDueFilter(e.target.value)}><option value="all">All dates</option><option value="overdue">Overdue</option><option value="upcoming">Upcoming</option></select><ChevronDown size={13}/></label></div></div>
 {error&&<div className="alert error"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}{notice&&<div className="alert success"><Check size={17}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={15}/></button></div>}
 {loading?<div className="loading"><LoaderCircle className="spin" size={25}/>Starting your workspace...</div>:view==='board'?<DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e:DragStartEvent)=>setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={()=>setActiveId(null)}><div className={activeId ? "radial-board is-dragging" : "radial-board"}>
 {statuses.map(status=><div className={'radial-zone zone-'+status} key={status}><LivingColumn status={status} tasks={visible.filter(t=>t.status===status).sort((a,b)=>a.position-b.position)} onOpen={setSelected} onAdd={setCreating} renderReviewActions={task => (
  <div className="review-actions" onClick={event => event.stopPropagation()}>
   <button type="button" className="primary-btn" disabled={reviewBusy} onClick={() => void submitReview(task, null)}>Approve</button>
   <button type="button" className="secondary-btn" disabled={reviewBusy} onClick={() => {
    setReviewNote('');
    setReviewError('');
    setReturningTask(task);
   }}>Request changes</button>
  </div>
 )}/></div>)}
 <div className="radial-hub"><div className="hub-mark"><LayoutDashboard size={25}/></div><h1>Project Hub</h1><p>Keep work flowing</p><div className="hub-metrics"><span><b>{counts.total}</b> Total</span><span><b>{counts.inProgress}</b> In Progress</span><span><b>{counts.inReview}</b> Review</span><span><b>{counts.completed}</b> Done</span></div><button type="button" className="hub-create" disabled={!userId} onClick={()=>setCreating('todo')}><Plus size={15}/> New Task</button></div>
 </div><DragOverlay>{activeTask?<TaskCard task={activeTask} overlay/>:null}</DragOverlay></DndContext>:<div className="task-list">{visible.length?visible.map(t=><button className="list-task" key={t.id} onClick={()=>setSelected(t)}><span className="list-status" style={{background:columnMeta[t.status].dot}}/><span className="list-title">{t.title}</span><span className={'priority-pill '+t.priority}>{t.priority}</span><span className="list-date">{t.due_date?dueLabel(t.due_date):'—'}</span><ArrowRight size={16}/></button>):<div className="list-empty">No tasks match your filters.</div>}</div>}
 <footer className="page-footer"><span><span className="footer-dot"/>Your tasks are securely saved to your workspace</span><span>Made for focus <span className="footer-heart">♥</span></span></footer></div></main>
 {creating&&<Modal onClose={()=>setCreating(null)}><div className="modal-heading"><div><div className="eyebrow">CREATE TASK</div><h2>Something new to work on</h2><p>Every great thing starts with a small step.</p></div><button className="icon-btn" onClick={()=>setCreating(null)} aria-label="Close"><X size={20}/></button></div><TaskForm initial={emptyInput(creating)} onSubmit={createTask} onCancel={()=>setCreating(null)} saving={saving}/></Modal>}
 {returningTask && <Modal onClose={() => { if (!reviewBusy) setReturningTask(null); }}>
  <div className="modal-heading"><div><h2>Request changes</h2><p>{returningTask.title}</p></div></div>
  <form onSubmit={event => {
   event.preventDefault();
   if (reviewNote.trim()) void submitReview(returningTask, reviewNote.trim());
  }}>
   <label className="field">What needs to change?
    <textarea autoFocus required maxLength={2000} rows={4} value={reviewNote}
     onChange={event => setReviewNote(event.target.value)} disabled={reviewBusy}/>
   </label>
   {reviewError && <p role="alert" className="alert error">{reviewError}</p>}
   <div className="modal-actions">
    <button type="button" className="secondary-btn" disabled={reviewBusy} onClick={() => setReturningTask(null)}>Cancel</button>
    <button type="submit" className="primary-btn" disabled={reviewBusy || !reviewNote.trim()}>Return to In Progress</button>
   </div>
  </form>
 </Modal>}
 {selected&&<Modal onClose={closeSelected}><div className="modal-heading"><div><div className="eyebrow">TASK DETAILS</div><h2>{editing?'Edit task':'Task details'}</h2><p>{editing?'Update your task information.':'All the details in one place.'}</p></div><button className="icon-btn" onClick={closeSelected} aria-label="Close"><X size={20}/></button></div>{editing?<TaskForm initial={{title:selected.title,description:selected.description||'',priority:selected.priority,due_date:selected.due_date||'',status:selected.status,category:selected.category||'general'}} onSubmit={updateTask} onCancel={()=>setEditing(false)} saving={saving}/>:<><div className="detail-content"><div className="detail-title-row"><h3>{selected.title}</h3><span className={'priority-pill '+selected.priority}>{selected.priority}</span></div><p className="detail-description">{selected.description||'No description added yet.'}</p><div className="detail-properties"><div><span>Category</span><strong>{categoryOptions.find(c=>c.value===(selected.category||'general'))?.label||'General'}</strong></div><div><span>Status</span><strong><i style={{background:columnMeta[selected.status].dot}}/>{columnMeta[selected.status].title}</strong></div><div><span>Due date</span><strong><CalendarDays size={15}/>{selected.due_date?format(parseISO(selected.due_date),'MMM d, yyyy'):'Not set'}</strong></div><div><span>Created</span><strong><Clock3 size={15}/>{format(parseISO(selected.created_at),'MMM d, yyyy')}</strong></div></div><div className="detail-actions"><button className="secondary-btn" onClick={()=>setEditing(true)}>Edit task</button><button className="delete-btn" onClick={()=>void deleteTask()} disabled={saving}><Trash2 size={16}/>Delete</button></div></div><div className="comments-section"><h3><MessageCircle size={18}/>Comments <span>{comments.length}</span></h3>{commentsLoading?<div className="comments-loading"><LoaderCircle className="spin" size={18}/>Loading comments...</div>:comments.length?<div className="comments-list">{comments.map(c=><div className="comment" key={c.id}><div className="comment-avatar">G</div><div><div className="comment-meta"><strong>Guest</strong><span>{formatDistanceToNow(parseISO(c.created_at),{addSuffix:true})}</span></div><p>{c.body}</p></div></div>)}</div>:<p className="no-comments">No comments yet. Start the conversation.</p>}<form className="comment-compose" onSubmit={e=>{e.preventDefault();void sendComment()}}><input aria-label="Write a comment" maxLength={2000} placeholder="Write a comment..." value={commentText} onChange={e=>setCommentText(e.target.value)}/><button type="submit" aria-label="Post comment" disabled={!commentText.trim()||saving}><Send size={17}/></button></form></div></>}</Modal>}
 </div>;
}
