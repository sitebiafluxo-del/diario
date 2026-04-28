/**
 * Audio recording utility using MediaRecorder API
 */

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = null;
    this.onDurationUpdate = null;
    this.durationInterval = null;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = this.getSupportedMimeType();
      console.log('Iniciando gravação com mimeType:', mimeType);

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
      });

      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('Chunk recebido:', event.data.size, 'bytes');
        }
      };

      this.mediaRecorder.start(250); // Coleta dados a cada 250ms
      this.isRecording = true;

      // Duration tracking
      this.durationInterval = setInterval(() => {
        if (this.onDurationUpdate) {
          const duration = (Date.now() - this.startTime) / 1000;
          this.onDurationUpdate(duration);
        }
      }, 100);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        console.warn('MediaRecorder não está ativo');
        resolve(null);
        return;
      }

      clearInterval(this.durationInterval);

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || this.getSupportedMimeType();
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - this.startTime) / 1000;

        console.log('Gravação finalizada. Tamanho total:', blob.size, 'bytes');

        this.cleanup();

        resolve({ blob, url, duration, mimeType });
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    // Não limpamos audioChunks aqui para permitir a criação do Blob no onstop
  }

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
}

export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
