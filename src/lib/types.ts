export const statuses = ['todo','in_progress','in_review','done'] as const;
export type Status = typeof statuses[number];
export type Priority = 'low'|'normal'|'high';
export type TaskCategory = 'general'|'feature'|'bug'|'design'|'research';
export interface Task {id:string;user_id:string;title:string;description:string|null;status:Status;priority:Priority;category:TaskCategory;due_date:string|null;position:number;created_at:string;updated_at:string}
export interface Comment {id:string;task_id:string;user_id:string;body:string;created_at:string}
export const columnMeta: Record<Status,{title:string;dot:string;hint:string}> = {
 todo:{title:'To Do',dot:'#8c91a2',hint:'Ideas ready to take shape'},
 in_progress:{title:'In Progress',dot:'#5b79ee',hint:'Work currently moving'},
 in_review:{title:'In Review',dot:'#dc9b45',hint:'Almost across the finish line'},
 done:{title:'Done',dot:'#43aa8b',hint:'Great work, all wrapped up'}
};
