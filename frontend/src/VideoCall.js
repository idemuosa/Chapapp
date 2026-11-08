import React, { useEffect, useRef, useState } from 'react';

function VideoCall({ socket, username, initialTargetId, initialCallType = 'video' }) {
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, in-call
  const [remoteUserId, setRemoteUserId] = useState(initialTargetId || null);
  const [callType, setCallType] = useState(initialCallType);
  const [incomingCall, setIncomingCall] = useState(null); // { from, username, offer, callType }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef();
  const localStreamRef = useRef();

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  const cleanupCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallStatus('idle');
    setRemoteUserId(null);
    setIncomingCall(null);
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('call-made', (data) => {
      setIncomingCall(data);
    });

    socket.on('answer-made', async (data) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('in-call');
      }
    });

    socket.on('ice-candidate', (data) => {
      if (peerConnection.current) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('call-rejected', () => {
      alert('The user declined your call.');
      cleanupCall();
    });

    socket.on('call-ended', () => {
      alert('Call ended.');
      cleanupCall();
    });

    if (initialTargetId && callStatus === 'idle') {
      startCall(initialTargetId, initialCallType);
    }

    return () => {
      socket.off('call-made');
      socket.off('answer-made');
      socket.off('ice-candidate');
      socket.off('call-rejected');
      socket.off('call-ended');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, initialTargetId, initialCallType]);

  const startCall = async (targetId, type = 'video') => {
    if (!targetId) return;
    setRemoteUserId(targetId);
    setCallType(type);
    setCallStatus('calling');

    try {
      const constraints = {
        audio: true,
        video: type === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection(config);
      stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

      peerConnection.current.ontrack = ({ streams: [remoteStream] }) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: targetId, candidate: event.candidate });
        }
      };

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socket.emit('call-user', { to: targetId, offer, callType: type });
    } catch (err) {
      console.error('Error starting call:', err);
      alert('Could not access microphone or camera.');
      cleanupCall();
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    const { from, offer, callType: incomingType } = incomingCall;
    setRemoteUserId(from);
    setCallType(incomingType || 'video');
    setCallStatus('in-call');

    try {
      const constraints = {
        audio: true,
        video: incomingType === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current && incomingType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection(config);
      stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

      peerConnection.current.ontrack = ({ streams: [remoteStream] }) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: from, candidate: event.candidate });
        }
      };

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit('make-answer', { to: from, answer });
      setIncomingCall(null);
    } catch (err) {
      console.error('Error answering call:', err);
      alert('Could not access microphone or camera.');
      cleanupCall();
    }
  };

  const declineIncomingCall = () => {
    if (incomingCall) {
      socket.emit('reject-call', { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  const hangUp = () => {
    if (remoteUserId) {
      socket.emit('end-call', { to: remoteUserId });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="video-call-container">
      {/* Incoming Call Dialog Modal */}
      {incomingCall && (
        <div className="incoming-call-modal">
          <div className="incoming-call-card">
            <div className="incoming-caller-avatar">
              {incomingCall.username ? incomingCall.username.charAt(0).toUpperCase() : '📞'}
            </div>
            <h3>Incoming {incomingCall.callType === 'audio' ? 'Audio' : 'Video'} Call</h3>
            <p><strong>{incomingCall.username || `User #${incomingCall.from}`}</strong> is calling you...</p>
            <div className="modal-actions">
              <button className="accept-call-btn" onClick={acceptIncomingCall}>
                Accept
              </button>
              <button className="decline-call-btn" onClick={declineIncomingCall}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Call Stage */}
      <div className={`call-stage ${callType === 'audio' ? 'audio-mode' : 'video-mode'}`}>
        {callType === 'audio' ? (
          <div className="audio-call-display">
            <div className="audio-avatar-pulse">
              <span className="audio-avatar-icon">🎙️</span>
            </div>
            <h3>Audio Call with User #{remoteUserId || 'Someone'}</h3>
            <p className="call-status-badge">{callStatus.toUpperCase()}</p>
            {/* Hidden audio element for remote stream playback */}
            <audio ref={remoteVideoRef} autoPlay />
          </div>
        ) : (
          <div className="videos">
            <div className="video-wrapper local">
              <label>You</label>
              <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
            </div>
            <div className="video-wrapper remote">
              <label>Remote</label>
              <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            </div>
          </div>
        )}
      </div>

      <div className="call-controls">
        {callStatus === 'idle' ? (
          <div className="start-call-form">
            <input type="text" placeholder="Enter User ID to call" id="targetId" />
            <button
              className="start-call-btn audio-btn"
              onClick={() => startCall(document.getElementById('targetId').value, 'audio')}
            >
              📞 Audio Call
            </button>
            <button
              className="start-call-btn video-btn"
              onClick={() => startCall(document.getElementById('targetId').value, 'video')}
            >
              📹 Video Call
            </button>
          </div>
        ) : (
          <div className="in-call-actions">
            <button className="control-btn" onClick={toggleMute}>
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            {callType === 'video' && (
              <button className="control-btn" onClick={toggleVideo}>
                {isVideoDisabled ? '📷 Start Video' : '🚫 Stop Video'}
              </button>
            )}
            <button onClick={hangUp} className="hangup-btn">
              🔴 Hang Up
            </button>
          </div>
        )}
        <div className="call-status-info">
          <span>Status: <strong>{callStatus}</strong></span>
          {remoteUserId && <span> | Peer ID: <strong>{remoteUserId}</strong></span>}
          <span> | Mode: <strong>{callType.toUpperCase()}</strong></span>
        </div>
      </div>
    </div>
  );
}

export default VideoCall;
