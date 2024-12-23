import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
} from "@heygen/streaming-avatar";

// DOM Elements
const localVideoElement = document.getElementById("local-video") as HTMLVideoElement | null;
const aiVideoElement = document.getElementById("ai-video") as HTMLVideoElement | null;
const startCameraButton = document.getElementById("startCamera") as HTMLButtonElement | null;
const stopCameraButton = document.getElementById("stopCamera") as HTMLButtonElement | null;
const startSessionButton = document.getElementById("startSession") as HTMLButtonElement | null;
const endSessionButton = document.getElementById("endSession") as HTMLButtonElement | null;
const speakButton = document.getElementById("speakButton") as HTMLButtonElement | null;
const userInput = document.getElementById("userInput") as HTMLInputElement | null;
const processingStatus = document.getElementById("processingStatus") as HTMLDivElement | null;
const errorStatus = document.getElementById("errorStatus") as HTMLDivElement | null;
const loadingIndicator = document.querySelector(".loading-indicator") as HTMLElement | null;

// HeyGen API Configuration
const API_CONFIG = {
  apiKey: 'MGY0ZGEwNGVjMWYyNGQxMTkxZGFlNWI3NGE3ZDYzZTktMTczNDYxMjg3MA==', // Replace with your actual HeyGen API Key
  serverUrl: 'https://api.heygen.com',
};

let avatar: StreamingAvatar | null = null;
let sessionInfo: any = null;
let cameraStream: MediaStream | null = null;

// Helper function to fetch access token for HeyGen
async function fetchAccessToken(): Promise<string> {
  const response = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.create_token`, {
    method: 'POST',
    headers: { 'X-Api-Key': API_CONFIG.apiKey },
  });

  const { data } = await response.json();
  console.log("Access token fetched:", data.token); // Debugging breakpoint
  return data.token;
}

// Get response from ChatGPT through backend API
async function getChatGPTResponse(userMessage: string): Promise<string> {
  if (!userMessage.trim()) {
    throw new Error("Message cannot be empty.");
  }

  console.log("Sending message to backend:", userMessage); // Debugging breakpoint
  const response = await fetch('https://ai-backend-tbbk.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage }),
  });

  if (!response.ok) {
    throw new Error('Failed to get response from backend');
  }

  const data = await response.json();
  console.log("ChatGPT response received:", data.response); // Debugging breakpoint
  return data.response;
}

// Show/hide processing status
function showProcessingStatus(show: boolean): void {
  if (processingStatus && loadingIndicator) {
    processingStatus.classList.toggle('active', show);
    loadingIndicator.classList.toggle('active', show);
  }
}

// Show/hide error status
function showErrorStatus(show: boolean): void {
  if (errorStatus) {
    errorStatus.classList.toggle('active', show);
  }
}

// Initialize HeyGen Avatar Session
async function initializeAvatarSession(): Promise<void> {
  if (!startSessionButton || !endSessionButton || !speakButton || !userInput) return;

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
  speakButton.disabled = false;
  userInput.disabled = false;

  avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
  avatar.on(StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected);
}

// Handle HeyGen stream ready event
function handleStreamReady(event: any): void {
  if (event.detail && aiVideoElement) {
    aiVideoElement.srcObject = event.detail;
    aiVideoElement.onloadedmetadata = () => {
      aiVideoElement?.play().catch(console.error);
    };
    console.log("HeyGen stream is ready and playing."); // Debugging breakpoint
  } else {
    alert("streaming not availble, limit exceed refresh the page")
    console.error("Stream is not available.");
  }
}

// Handle HeyGen stream disconnected event
function handleStreamDisconnected(): void {
  console.log("Stream disconnected");

  if (!startSessionButton || !endSessionButton || !speakButton || !userInput) return;

  if (aiVideoElement) aiVideoElement.srcObject = null;

  startSessionButton.disabled = false;
  endSessionButton.disabled = true;
  speakButton.disabled = true;
  userInput.disabled = true;
}

// Terminate HeyGen Avatar Session
async function terminateAvatarSession(): Promise<void> {
  if (!avatar || !sessionInfo || !startSessionButton || !endSessionButton || !speakButton || !userInput) return;

  await avatar.stopAvatar();
  if (aiVideoElement) aiVideoElement.srcObject = null;
  avatar = null;

  startSessionButton.disabled = false;
  endSessionButton.disabled = true;
  speakButton.disabled = true;
  userInput.disabled = true;
  console.log("HeyGen session terminated"); // Debugging breakpoint
}

// Send text to HeyGen Avatar for speaking
async function sendTextToAvatar(text: string): Promise<void> {
  if (!sessionInfo) {
    throw new Error("Session information is missing.");
  }

  console.log("Sending text to HeyGen avatar:", text); // Debugging breakpoint
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
  console.log("Text sent to HeyGen avatar successfully."); // Debugging breakpoint
}

// Handle avatar speak event
async function handleSpeak(): Promise<void> {
  if (!avatar || !userInput || !userInput.value.trim()) return;

  try {
    showProcessingStatus(true);
    showErrorStatus(false);
    if (speakButton) speakButton.disabled = true;

    // Fetch response from ChatGPT
    const chatGPTResponse = await getChatGPTResponse(userInput.value);

    // Send ChatGPT response to HeyGen Avatar
    await sendTextToAvatar(chatGPTResponse);

    userInput.value = "";
  } catch (error) {
    alert("limit exceed, pls refresh the page")
    console.error("Error in conversation flow:", error);
    showErrorStatus(true);
  } finally {
    showProcessingStatus(false);
    if (speakButton) speakButton.disabled = false;
  }
}

// Camera control
async function startCamera(): Promise<void> {
  if (!localVideoElement || !startCameraButton || !stopCameraButton) return;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideoElement.srcObject = cameraStream;

    stopCameraButton.disabled = false;
    startCameraButton.disabled = true;
    console.log("Camera started"); // Debugging breakpoint
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
  console.log("Camera stopped"); // Debugging breakpoint
}

// Attach Event Listeners
startCameraButton?.addEventListener("click", startCamera);
stopCameraButton?.addEventListener("click", stopCamera);
startSessionButton?.addEventListener("click", initializeAvatarSession);
endSessionButton?.addEventListener("click", terminateAvatarSession);
speakButton?.addEventListener("click", handleSpeak);
