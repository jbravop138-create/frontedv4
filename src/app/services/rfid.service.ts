import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { createClient, SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type RfidProducto = {
  id: string;
  nombre?: string | null;
  categoria_id?: string | null;
  uid?: string | null;
  talla?: string | null;
  color?: string | null;
  stock?: number | null;
  stock_actual?: number | null;
};

export type RfidLookupResult = {
  producto: RfidProducto | null;
  duplicates?: RfidProducto[];
};

@Injectable({
  providedIn: 'root'
})
export class RfidService {
  private supabase: SupabaseClient;
  
  // 1. TUS CREDENCIALES DE SUPABASE (Las mismas del ESP32)
  private readonly supabaseUrl = 'https://tywqrhvzodqzustmwphn.supabase.co';
  private readonly supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5d3FyaHZ6b2RxenVzdG13cGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxMzYsImV4cCI6MjA4MTY0ODEzNn0.FycwP43k72trGAl3ce7vzCNqoSH6PA53kmievQJYAGs';

  // Este "Subject" es como una antena de radio que emitirá el UID cuando llegue
  public nuevoTag$ = new Subject<string>();

  private channel: RealtimeChannel | null = null;

  constructor(private http: HttpClient) {
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  // Llama a esto cuando abras el modal de escanear
  iniciarEscucha() {
    if (this.channel) return;
    console.log('📡 Iniciando escucha de RFID en Supabase...');
    
    // Nos suscribimos a "INSERT" en la tabla 'lecturas'
    this.channel = this.supabase
      .channel('tabla-lecturas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lecturas' },
        (payload: RealtimePostgresChangesPayload<{ uid?: string }>) => {
          console.log('🔔 ¡Dato recibido!', payload);
          // Supabase devuelve el dato nuevo en payload.new
          const nuevoUid = (payload.new as { uid?: string })?.uid;
          if (nuevoUid) {
            this.nuevoTag$.next(nuevoUid); // Avisamos al componente
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado de suscripción:', status);
      });
  }

  // Llama a esto cuando cierres el modal para no gastar recursos
  detenerEscucha() {
    if (this.channel) {
      console.log('🔕 Deteniendo escucha RFID');
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  async buscarProductoPorUid(uid: string): Promise<RfidLookupResult> {
    const cleaned = String(uid ?? '').trim();
    if (!cleaned) return { producto: null };
    const compact = cleaned.replace(/\s+/g, '');
    const spaced = compact ? compact.match(/.{1,2}/g)?.join(' ') ?? compact : cleaned;
    const variants = Array.from(new Set([
      cleaned,
      compact,
      spaced,
      cleaned.toUpperCase(),
      cleaned.toLowerCase(),
      compact.toUpperCase(),
      compact.toLowerCase(),
      spaced.toUpperCase(),
      spaced.toLowerCase(),
    ])).filter(Boolean);

    const apiResult = await this.buscarEnApi(variants);
    if (apiResult.producto || apiResult.duplicates?.length) return apiResult;

    const { data, error } = await this.supabase
      .from('productos')
      .select('id,nombre,categoria_id,uid,talla,color,stock,stock_actual')
      .or(`uid.in.(${variants.join(',')}),sku.in.(${variants.join(',')})`)
      .limit(3);
    if (error || !data) return { producto: null };
    if (data.length > 1) return { producto: null, duplicates: data as RfidProducto[] };
    return { producto: (data[0] ?? null) as RfidProducto | null };
  }

  private async buscarEnApi(variants: string[]): Promise<RfidLookupResult> {
    try {
      let params = new HttpParams();
      const primary = variants[0] ?? '';
      if (primary) {
        params = params
          .set('uid', primary)
          .set('sku', primary)
          .set('codigo', primary)
          .set('q', primary)
          .set('search', primary);
      }
      const res = await firstValueFrom(this.http.get<unknown>(`${environment.apiUrl}/productos`, { params }));
      const list = this.extractList(res);
      if (!list.length && primary) {
        const paramsAlt = new HttpParams().set('sku', primary).set('codigo', primary);
        const resAlt = await firstValueFrom(this.http.get<unknown>(`${environment.apiUrl}/productos`, { params: paramsAlt }));
        const listAlt = this.extractList(resAlt);
        if (!listAlt.length) return { producto: null };
        return this.findMatches(listAlt, variants);
      }

      return this.findMatches(list, variants);
    } catch {
      return { producto: null };
    }
  }

  private findMatches(list: any[], variants: string[]): RfidLookupResult {
    const matches = list.filter((p) => {
      const val = String(
        (p as any)?.uid ??
        (p as any)?.codigo_rfid ??
        (p as any)?.rfid ??
        (p as any)?.codigo ??
        (p as any)?.sku ??
        ''
      ).trim();
      return val && variants.includes(val);
    }) as RfidProducto[];

    if (!matches.length) return { producto: null };
    if (matches.length > 1) return { producto: null, duplicates: matches };
    return { producto: matches[0] ?? null };
  }

  private extractList(res: unknown): any[] {
    const payload: any = (res as any)?.data ?? res ?? {};
    const raw = Array.isArray(payload) ? payload : Array.isArray((res as any)?.data) ? (res as any).data : payload?.items ?? payload?.data ?? payload?.productos ?? payload?.rows ?? [];
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.rows) ? raw.rows : Array.isArray(raw?.data) ? raw.data : [];
    return Array.isArray(list) ? list : [];
  }
}
