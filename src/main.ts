import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
} from "@heygen/streaming-avatar";

const localVideoElement = document.getElementById("local-video") as HTMLVideoElement | null;
const aiVideoElement = document.getElementById("ai-video") as HTMLVideoElement | null;
const startCameraButton = document.getElementById("startCamera") as HTMLButtonElement | null;
const stopCameraButton = document.getElementById("stopCamera") as HTMLButtonElement | null;
const startSessionButton = document.getElementById("startSession") as HTMLButtonElement | null;
const endSessionButton = document.getElementById("endSession") as HTMLButtonElement | null;
const recordButton = document.getElementById("recordButton") as HTMLButtonElement | null;
const transcriptionText = document.getElementById("transcriptionText") as HTMLDivElement | null;
const processingStatus = document.getElementById("processingStatus") as HTMLDivElement | null;
const errorStatus = document.getElementById("errorStatus") as HTMLDivElement | null;
const loadingIndicator = document.querySelector(".loading-indicator") as HTMLElement | null;

const API_CONFIG = {
  apiKey: 'MGY0ZGEwNGVjMWYyNGQxMTkxZGFlNWI3NGE3ZDYzZTktMTczNDYxMjg3MA==',
  serverUrl: 'https://api.heygen.com',
};

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

type SpeechRecognition = any;

let avatar: StreamingAvatar | null = null;
let sessionInfo: any = null;
let cameraStream: MediaStream | null = null;
let recognition: SpeechRecognition;

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
} else {
  console.error('Speech recognition not supported in this browser');
}
async function fetchAccessToken(): Promise<string> {
  const response = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.create_token`, {
    method: 'POST',
    headers: { 'X-Api-Key': API_CONFIG.apiKey },
  });

  const { data } = await response.json();
  console.log("Access token fetched:", data.token);
  return data.token;
}

async function getChatGPTResponse(userMessage: string): Promise<string> {
  if (!userMessage.trim()) {
    throw new Error("Message cannot be empty.");
  }

  console.log("Sending message to backend:", userMessage);
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage }),
  });

  if (!response.ok) {
    throw new Error('Failed to get response from backend');
  }

  const data = await response.json();
  console.log("ChatGPT response received:", data.response);
  return data.response;
}

function showProcessingStatus(show: boolean): void {
  if (processingStatus && loadingIndicator) {
    processingStatus.classList.toggle('active', show);
    loadingIndicator.classList.toggle('active', show);
  }
}

function showErrorStatus(show: boolean): void {
  if (errorStatus) {
    errorStatus.classList.toggle('active', show);
  }
}

async function initializeAvatarSession(): Promise<void> {
  if (!startSessionButton || !endSessionButton || !recordButton) return;

  const token = await fetchAccessToken();
  avatar = new StreamingAvatar({ token });

  try {
    sessionInfo = await avatar.createStartAvatar({
      quality: AvatarQuality.High,
      avatarName: "default",
    });
  } catch (error) {
    alert("limit exceed, refresh the page")
  }

  console.log("Session data:", sessionInfo);

  endSessionButton.disabled = false;
  startSessionButton.disabled = true;
  recordButton.disabled = false;

  avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
  avatar.on(StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected);
}

function handleStreamReady(event: any): void {
  if (event.detail && aiVideoElement) {
    aiVideoElement.srcObject = event.detail;
    aiVideoElement.onloadedmetadata = () => {
      aiVideoElement?.play().catch(console.error);
    };
    console.log("HeyGen stream is ready and playing.");
  } else {
    alert("streaming not available, limit exceed refresh the page")
    console.error("Stream is not available.");
  }
}

function handleStreamDisconnected(): void {
  console.log("Stream disconnected");

  if (!startSessionButton || !endSessionButton || !recordButton) return;

  if (aiVideoElement) aiVideoElement.srcObject = null;

  startSessionButton.disabled = false;
  endSessionButton.disabled = true;
  recordButton.disabled = true;
}

async function terminateAvatarSession(): Promise<void> {
  if (!avatar || !sessionInfo || !startSessionButton || !endSessionButton || !recordButton) return;

  await avatar.stopAvatar();
  if (aiVideoElement) aiVideoElement.srcObject = null;
  avatar = null;

  startSessionButton.disabled = false;
  endSessionButton.disabled = true;
  recordButton.disabled = true;
  console.log("HeyGen session terminated");
}

async function sendTextToAvatar(text: string): Promise<void> {
  if (!sessionInfo) {
    throw new Error("Session information is missing.");
  }

  console.log("Sending text to HeyGen avatar:", text);
  await fetch(`${API_CONFIG.serverUrl}/v1/streaming.task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify({
      session_id: sessionInfo.session_id,
      text: text,
    }),
  });
  console.log("Text sent to HeyGen avatar successfully.");
}

let isRecording = false;

async function toggleRecording(): Promise<void> {
  if (!recordButton) return;

  if (!isRecording) {
    isRecording = true;
    recordButton.style.backgroundColor = '#dc3545';
    recordButton.textContent = '🎤 Recording... Click to Stop';
    recognition.start();
  } else {
    isRecording = false;
    recordButton.style.backgroundColor = '#007bff';
    recordButton.textContent = '🎤 Click to Speak';
    recognition.stop();
  }
}

recognition.onresult = async (event : any) => {
  const transcript = event.results[0][0].transcript;
  console.log(transcript);
  if (transcriptionText) {
    transcriptionText.textContent = `You said: ${transcript}`;
  }

  try {
    showProcessingStatus(true);
    showErrorStatus(false);
    if (recordButton) recordButton.disabled = true;

    const chatGPTResponse = await getChatGPTResponse(transcript);

    await sendTextToAvatar(chatGPTResponse);

  } catch (error) {
    alert("limit exceed, pls refresh the page")
    console.error("Error in conversation flow:", error);
    showErrorStatus(true);
  } finally {
    showProcessingStatus(false);
    if (recordButton) recordButton.disabled = false;
  }
};

recognition.onerror = (event : any) => {
  console.error('Speech recognition error:', event.error);
  isRecording = false;
  if (recordButton) {
    recordButton.style.backgroundColor = '#007bff';
    recordButton.textContent = '🎤 Click to Speak';
  }
};

async function startCamera(): Promise<void> {
  if (!localVideoElement || !startCameraButton || !stopCameraButton) return;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideoElement.srcObject = cameraStream;

    stopCameraButton.disabled = false;
    startCameraButton.disabled = true;
    console.log("Camera started");
  } catch (error) {
    console.error("Error accessing the camera:", error);
    alert("Unable to access camera. Please check permissions.");
  }
}

function stopCamera(): void {
  if (!localVideoElement || !startCameraButton || !stopCameraButton || !cameraStream) return;

  cameraStream.getTracks().forEach((track) => track.stop());
  localVideoElement.srcObject = null;
  cameraStream = null;

  stopCameraButton.disabled = true;
  startCameraButton.disabled = false;
  console.log("Camera stopped");
}
startCameraButton?.addEventListener("click", startCamera);
stopCameraButton?.addEventListener("click", stopCamera);
startSessionButton?.addEventListener("click", initializeAvatarSession);
endSessionButton?.addEventListener("click", terminateAvatarSession);
recordButton?.addEventListener("click", toggleRecording);