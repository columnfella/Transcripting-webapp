export let transcript = {};
export let transcriptionData = {};

export function setTranscript(data) {
    transcript = data;
    transcriptionData = data;
}

console.log("Registering transcriptReady listener");

window.addEventListener('transcriptReady', (event) => {
    setTranscript(event.detail);
    console.log(`Received transcript in other JS file:`, transcript);
});