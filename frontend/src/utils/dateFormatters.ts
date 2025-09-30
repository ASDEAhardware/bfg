
/**
 * Formatta una data nel formato italiano (gg/mm/aaaa).
 * @param date - La data da formattare. Può essere una stringa ISO, un timestamp, o un oggetto Date.
 * @returns La data formattata come stringa in formato italiano.
 */
export const formatDateToItalian = (date: Date | string | number): string => {
    // Crea un oggetto Date. Se è già un oggetto Date, lo usa; altrimenti, ne crea uno.
    const dateObj = date instanceof Date ? date : new Date(date);

    // Controlla se la data è valida (es. evita "Invalid Date")
    if (isNaN(dateObj.getTime())) {
        return 'Data non valida';
    }

    // Opzioni per la formattazione locale italiana (giorno numerico, mese numerico, anno numerico)
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    };

    // Utilizza Intl.DateTimeFormat per la formattazione con la locale 'it-IT'
    return new Intl.DateTimeFormat('it-IT', options).format(dateObj);
};

/**
 * Formatta una data nel formato americano (mm/gg/aaaa).
 * @param date - La data da formattare. Può essere una stringa ISO, un timestamp, o un oggetto Date.
 * @returns La data formattata come stringa in formato americano.
 */
export const formatDateToAmerican = (date: Date | string | number): string => {
    // Crea un oggetto Date. Se è già un oggetto Date, lo usa; altrimenti, ne crea uno.
    const dateObj = date instanceof Date ? date : new Date(date);

    // Controlla se la data è valida (es. evita "Invalid Date")
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date'; // o il messaggio che preferisci in inglese
    }

    // Opzioni per la formattazione locale americana (mese numerico, giorno numerico, anno numerico)
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    };

    // Utilizza Intl.DateTimeFormat per la formattazione con la locale 'en-US'
    // Nota: 'en-US' produce mm/dd/yyyy
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
};
    