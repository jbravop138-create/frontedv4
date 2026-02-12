import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserDashboardService {
  historial(arg0: { limit: number; offset: number; }) {
    throw new Error('Method not implemented.');
  }
  constructor(private http: HttpClient) {}
  getDashboard() {
    return this.http.get<any>(`${environment.apiUrl}/user/dashboard`);
  }
}