import {z} from 'zod';
export const reportReasonSchema=z.enum(['spam','harassment','hate','scam','other']);
export type ReportReason=z.infer<typeof reportReasonSchema>;
export const REPORT_REASONS:Record<ReportReason,string>={spam:'Spam or flooding',harassment:'Harassment or threats',hate:'Hateful or degrading content',scam:'Scam or unsafe solicitation',other:'Other concern'};
export const reportReceiptSchema=z.object({requestId:z.string().uuid(),status:z.enum(['saved','duplicate','unavailable','limited']),reportId:z.string().uuid().optional(),reviewConfigured:z.boolean()}).strict();
export type ReportReceipt=z.infer<typeof reportReceiptSchema>;
export const REVIEW_TTL=7*24*60*60_000,MUTE_MS=15*60_000;
