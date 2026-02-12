export type StockStatus = 'ok' | 'low' | 'critical';

export interface InventoryProduct {
  id: string;
  codigo_rfid: string;
  nombre: string;
  categoria: string;

  // detalles
  talla?: string | null;
  color?: string | null;

  stock: number;
  precio: number;
}

export interface InventoryResponse {
  items: InventoryProduct[];
  categorias: string[];
}