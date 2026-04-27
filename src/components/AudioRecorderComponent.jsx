import { useState, useRef } from 'react';
import { AudioRecorder, formatDuration } from '../lib/audioRecorder';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';

export default function AudioRecorderComponent({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);

  const isSupported = AudioRecorder.isSupported();

  async function startRecording() {
    setError('');
    try {
      const recorder = new AudioRecorder();
      recorder.onDurationUpdate = setDuration;
      await recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(err.message || 'Erro ao iniciar gravação');
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;

    try {
      const result = await recorderRef.current.stop();
      setIsRecording(false);
      setDuration(0);

      if (result && onRecordingComplete) {
        onRecordingComplete(result);
      }
    } catch (err) {
      setError('Erro ao parar gravação');
      setIsRecording(false);
    }
  }

  if (!isSupported) {
    return (
      <div className="audio-recorder-unsupported">
        <AlertCircle size={18} />
        <span>Gravação de áudio não disponível neste navegador</span>
      </div>
    );
  }

  return (
    <div className="audio-recorder">
      {error && (
        <div className="audio-error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {isRecording ? (
        <div className="recording-active">
          <div className="recording-pulse"></div>
          <span className="recording-duration">{formatDuration(duration)}</span>
          <button
            id="stop-recording"
            className="record-button recording"
            onClick={stopRecording}
            aria-label="Parar gravação"
          >
            <Square size={20} fill="currentColor" />
          </button>
        </div>
      ) : (
        <button
          id="start-recording"
          className="record-button"
          onClick={startRecording}
          aria-label="Iniciar gravação"
        >
          <Mic size={20} />
          <span>Gravar</span>
        </button>
      )}
    </div>
  );
}
