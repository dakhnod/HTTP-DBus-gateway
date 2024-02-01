const url = `${location.protocol.replace('http', 'ws')}//${location.host}/api/signals`
const socket = new WebSocket(url);

// Eventlistener für das Öffnen der Verbindung
socket.addEventListener('open', (event) => {
    console.log('WebSocket geöffnet');
});

// Eventlistener für das Empfangen von Nachrichten
socket.addEventListener('message', (event) => {
    const receivedData = event.data;
    console.log('Nachricht erhalten:', receivedData);

    const json = JSON.parse(receivedData)

    const item_values = json.args[1]

    for(const item_id in item_values){
      const element = document.querySelector(`[data-item-id=${item_id}]`)

      const item_state = item_values[item_id]

      if (element) {
        if(element.dataset.itemType == 'counter'){
          element.querySelector('input').value = item_state
        }else{
          element.style.backgroundColor = item_state ? '#55ff55' : '#ff5555'
        }
        element.dataset.itemValue = item_state
      } else {
        console.error(`Item ${item_id} nicht gefunden.`);
      }
    }

    // Hier kannst du die empfangenen Daten weiter verarbeiten

});

// Eventlistener für das Schließen der Verbindung
socket.addEventListener('close', (event) => {
    console.log('WebSocket geschlossen');
});


