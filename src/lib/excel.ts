import * as XLSX from 'xlsx';
import { totalQty } from './supabase';

export interface ExportOptions {
  includeCommercialName?: boolean;
  includeType?: boolean;
}

// Funzione di utilità per pulire e aggiungere data/ora una sola volta nel nome file
const getTimestampedFilename = (baseTitle: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const cleanTitle = baseTitle.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/, '');

  const cleanBase = cleanTitle
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_');

  return `${cleanBase}_${year}-${month}-${day}_${hours}-${minutes}`;
};

export function exportOrderExcel(orders: any[]) {
  const wb = XLSX.utils.book_new();

  const selectedOrders = orders.filter(o => 
    (o.selectedAcc && (o.orderAcc || 0) > 0) || (o.selectedNonAcc && (o.orderNonAcc || 0) > 0)
  );

  if (selectedOrders.length === 0) {
    alert("Seleziona almeno un articolo spuntando le caselle e assicurati che la quantità da ordinare sia maggiore di 0 prima di esportare in Excel.");
    return;
  }

  const farmaciItems = selectedOrders.filter(o => o.category === 'farmaco');
  const presidiItems = selectedOrders.filter(o => o.category === 'presidio');

  if (farmaciItems.length > 0) {
    const farmaciRows = farmaciItems.map(o => {
      const row: Record<string, any> = {
        'Principio Attivo': o.dosage && o.dosage !== '—' ? `${o.active_ingredient} ${o.dosage}` : o.active_ingredient
      };
      
      if (o.selectedAcc && (o.orderAcc || 0) > 0) {
        row['Scatole da Ordinare (Acc.)'] = o.orderAcc;
      }
      if (o.selectedNonAcc && (o.orderNonAcc || 0) > 0) {
        row['Scatole da Ordinare (Non Acc.)'] = o.orderNonAcc;
      }

      return row;
    }).filter(r => Object.keys(r).length > 1);

    if (farmaciRows.length > 0) {
      const wsFarmaci = XLSX.utils.json_to_sheet(farmaciRows);
      wsFarmaci['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsFarmaci, "Farmaci");
    }
  }

  if (presidiItems.length > 0) {
    const presidiRows = presidiItems.map(o => {
      const row: Record<string, any> = {
        'Nome Presidio': o.active_ingredient
      };
      
      if (o.selectedAcc && (o.orderAcc || 0) > 0) {
        row['Scatole da Ordinare (Acc.)'] = o.orderAcc;
      }
      if (o.selectedNonAcc && (o.orderNonAcc || 0) > 0) {
        row['Scatole da Ordinare (Non Acc.)'] = o.orderNonAcc;
      }

      return row;
    }).filter(r => Object.keys(r).length > 1);

    if (presidiRows.length > 0) {
      const wsPresidi = XLSX.utils.json_to_sheet(presidiRows);
      wsPresidi['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsPresidi, "Presidi");
    }
  }

  const filename = getTimestampedFilename("Ordine_Quindicinale");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMedicationsExcel(
  medications: any[], 
  title: string, 
  selectedFloor: string = 'all',
  options: { includeCommercialName: boolean; includeType: boolean } = { includeCommercialName: true, includeType: true }
) {
  const isPresidioExport = medications.some(m => m.category === 'presidio' || m.item_type?.toLowerCase() === 'presidio');
  const hasPresidi = isPresidioExport || medications.some(m => m.qty_mc > 0);

  const formatRows = (items: any[]) => items.map(m => {
    const row: Record<string, any> = {};

    if (isPresidioExport) {
      row['Nome Presidio'] = m.active_ingredient;
      row['Pezzi per Scatola'] = m.pack_size || 1;
      
      if (options.includeCommercialName) {
        row['Nome Commerciale'] = m.commercial_name && m.commercial_name !== '—' ? m.commercial_name : '—';
      }
    } else {
      row['Principio Attivo'] = m.active_ingredient;
      row['Dosaggio'] = m.dosage || '—';

      if (options.includeType) {
        row['Tipo'] = m.item_type || '—';
      }

      if (options.includeCommercialName) {
        row['Nome Commerciale'] = m.commercial_name || '—';
      }
    }

    if (selectedFloor === 'mc') {
      row['Magazzino Centrale (MC)'] = m.qty_mc || 0;
    } else if (selectedFloor === 'pt') {
      row['Piano Terra (PT)'] = m.qty_pt || 0;
    } else if (selectedFloor === '1') {
      row['Piano 1'] = m.qty_1 || 0;
    } else if (selectedFloor === '2') {
      row['Piano 2'] = m.qty_2 || 0;
    } else if (selectedFloor === '3') {
      row['Piano 3'] = m.qty_3 || 0;
    } else if (selectedFloor === 'pl') {
      row['Palestra (PL)'] = m.qty_pl || 0;
    } else {
      if (hasPresidi) {
        row['Magazzino Centrale (MC)'] = m.qty_mc || 0;
      }
      row['Piano Terra (PT)'] = m.qty_pt || 0;
      row['Piano 1'] = m.qty_1 || 0;
      row['Piano 2'] = m.qty_2 || 0;
      row['Piano 3'] = m.qty_3 || 0;
      row['Palestra (PL)'] = m.qty_pl || 0;
      row['Totale'] = totalQty(m);
    }

    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formatRows(medications));
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  
  const filename = getTimestampedFilename(title);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export const exportOrdiniExcel = exportOrderExcel;