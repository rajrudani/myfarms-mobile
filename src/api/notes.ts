import apiClient from './client';
import { NoteReminder, CreateNoteReminderPayload, UpdateNoteReminderPayload, PaginatedResponse } from '../types';

export interface NoteFilters {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  per_page?: number | string;
}

export const notesApi = {
  async getAll(params?: NoteFilters): Promise<NoteReminder[]> {
    const response = await apiClient.get<PaginatedResponse<NoteReminder> | { data: NoteReminder[] }>('/note-reminders', {
      params: { per_page: 'all', ...params },
    });
    return Array.isArray(response.data) ? response.data : response.data.data;
  },

  async getNotesPaginated(params?: NoteFilters): Promise<PaginatedResponse<NoteReminder>> {
    const response = await apiClient.get<PaginatedResponse<NoteReminder>>('/note-reminders', { params });
    return response.data;
  },

  async getById(id: string | number): Promise<NoteReminder> {
    const response = await apiClient.get<{ data: NoteReminder }>(`/note-reminders/${id}`);
    return response.data.data;
  },

  async create(note: CreateNoteReminderPayload): Promise<NoteReminder> {
    const response = await apiClient.post<{ data: NoteReminder }>('/note-reminders', note);
    return response.data.data;
  },

  async update(id: string | number, note: UpdateNoteReminderPayload): Promise<NoteReminder> {
    const response = await apiClient.put<{ data: NoteReminder }>(`/note-reminders/${id}`, note);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/note-reminders/${id}`);
  },

  async toggleStatus(id: string | number): Promise<NoteReminder> {
    const response = await apiClient.post<{ data: NoteReminder }>(`/note-reminders/${id}/toggle-status`);
    return response.data.data;
  },
};
