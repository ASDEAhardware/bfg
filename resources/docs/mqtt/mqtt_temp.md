Update(src/plugins/devices/DevicesListPage.tsx)
  ⎿  Updated src/plugins/devices/DevicesListPage.tsx with 4 additions     
       214        d.datalogger_type.toLowerCase().includes('meteo')
       215      );
       216    
       217 +    console.log('  monstroDevice:', monstroDevice);
       218 +    console.log('  adaqDevices.length:', adaqDevices?.length);
       219 +    console.log('  weatherStationDevices.length:', 
           + weatherStationDevices?.length);
       220 +  
       221      // Check if any group is expanded
       222      const hasExpandedGroups = 
             Object.values(expandedGroups).some((v: boolean) => v);
       223    

● Ora aspetta un attimo che il frontend ricompili e poi apri la console del 
  browser (F12) su http://localhost:3000/devices per vedere i log! 🔍

  Nel frattempo, verifichiamo anche quale sito hai selezionato. Il datalogger è
  sul site_id 6. Hai "Diga del Vajont" selezionato nel selector siti?

● Bash(podman exec bfg_backend python manage.py shell -c "
      from sites.models import Site…)
  ⎿  21 objects imported automatically (use -v 2 for details).

     === SITI DISPONIBILI ===
     … +2 lines (ctrl+o to expand)

● Perfetto! Ci sono 2 siti. Il datalogger MONSTRO-TEST-001 è sul site ID 6 (Diga 
  del Vajont).

  🔍 Debug Checklist

  Apri Console Browser (F12 → Console) su http://localhost:3000/devices e
  controlla:

  1. Cosa vedi nei log 🔍 DEBUG DevicesListPage?
    - selectedSiteId: → Deve essere 6
    - dataloggers (raw): → Deve contenere almeno 1 elemento
    - monstroDevice: → Deve essere un oggetto (non undefined)
  2. Quale sito hai selezionato nel selector in alto a sinistra?
    - Deve essere "Diga del Vajont"
    - Se è "Laboratorio ASDEA" (site 13), non troverà nulla!
  3. Filtro "Solo Online" è attivo?
    - Il datalogger è offline, quindi se filtro attivo non lo vedi

  Dimmi cosa vedi nella console! 📊