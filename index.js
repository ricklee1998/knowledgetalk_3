//sunny) 본 knowledgetalk은 3명이상이여지만 가능하며, 3명이 모든 방에 참여가 된 후,
//그 중 함 명이, 화면 공유를 예약한다. 그리고 3명다 sdp로 offer와 answer를 전달한다.
//socket 연결
const clientIo = io.connect("https://dev.knowledgetalk.co.kr:7100/SignalServer",{});

const roomIdInput = document.getElementById("roomIdInput");
const videoBox = document.getElementById("videoBox");
const printBox = document.getElementById("printBox")

const CreateRoomBtn = document.getElementById("CreateRoomBtn");
const RoomJoinBtn = document.getElementById("RoomJoinBtn");
const SDPBtn = document.getElementById("SDPBtn");
//sunny) 공유예약 버튼과 공유예약 취소 버튼 생성
const ShareBtn = document.getElementById("ShareBtn");
const CancelBtn = document.getElementById("CancelBtn");

const CPCODE = "KP-CCC-demouser-01"
const AUTHKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdHNlcnZpY2UiLCJtYXhVc2VyIjoiMTAwIiwic3RhcnREYXRlIjoiMjAyMC0wOC0yMCIsImVuZERhdGUiOiIyMDIwLTEyLTMwIiwiYXV0aENvZGUiOiJLUC1DQ0MtdGVzdHNlcnZpY2UtMDEiLCJjb21wYW55Q29kZSI6IkxJQy0wMyIsImlhdCI6MTU5Nzk3NjQ3Mn0.xh_JgK67rNPufN2WoBa_37LzenuX_P7IEvvx5IbFZI4"

let members;
let roomId;
let userId;
//sunny) 초기 sdp 옵션중에 usage를 캠으로 설정
let usage="cam";
let host;

let peers = {};
let streams = {};

/********************** 기타 method **********************/

//print log on page
const socketLog = (type, contents) => {
    let jsonContents = JSON.stringify(contents);
    const textLine = document.createElement("p");
    const textContents = document.createTextNode(`[${type}] ${jsonContents}`);
    textLine.appendChild(textContents);
    printBox.appendChild(textLine);
}

//send message to signaling server
const sendData = data => {
    data.cpCode = CPCODE
    data.authKey = AUTHKEY
    socketLog('send', data);
    clientIo.emit("knowledgetalk", data);
}

const deletePeers = async () => {
    for(let key in streams) {
        if (streams[key] && streams[key].getTracks()) {
            streams[key].getTracks().forEach(track => {
                track.stop();
            })

            document.getElementById(key).srcObject = null;
            document.getElementById(key).remove();
        }
    }

    for(let key in peers) {
        if (peers[key]) {
            peers[key].close();
            peers[key] = null;
        }
    }
}

//영상 출력 화면 Box 생성
const createVideoBox = id => {
    let videoContainner = document.createElement("div");
    videoContainner.classList = "multi-video";
    videoContainner.id = id;

    let videoLabel = document.createElement("p");
    let videoLabelText = document.createTextNode(id);
    videoLabel.appendChild(videoLabelText);

    videoContainner.appendChild(videoLabel);

    let multiVideo = document.createElement("video");
    multiVideo.autoplay = true;
    multiVideo.id = "multiVideo-" + id;
    videoContainner.appendChild(multiVideo);

    videoBox.appendChild(videoContainner);
}
/*const createSDPScreenOffer = async id => {
    return new Promise(async (resolve, reject) => {
        peers[id] = new RTCPeerConnection();
        streams[id] = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
        let str = 'multiVideo-'+id;
        let multiVideo = document.getElementById(str);
        multiVideo.srcObject = streams[id];
        streams[id].getTracks().forEach(track => {
            peers[id].addTrack(track, streams[id]);
        });

        peers[id].createOffer().then(sdp => {
            peers[id].setLocalDescription(sdp);
            return sdp;
        }).then(sdp => {
            resolve(sdp);
        })
    })
}*/
//Local stream, peer 생성 및 sdp return
const createSDPOffer = async id => {
    return new Promise(async (resolve, reject) => {
        peers[id] = new RTCPeerConnection();
        console.log("준비물:"+host+", "+usage)
        //sunny) 캠인지 화면공유인지 구분
        if(usage == "cam"){
            streams[id] = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        }else if(usage == "screen"){
            streams[id] = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false});
        }
        //if(host == false){
        //streams[id] = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        //}else if(host == true){
        //    streams[id] = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false});
        //}
        
        let str = 'multiVideo-'+id;
        let multiVideo = document.getElementById(str);
        multiVideo.srcObject = streams[id];
        streams[id].getTracks().forEach(track => {
            peers[id].addTrack(track, streams[id]);
        });

        peers[id].createOffer().then(sdp => {
            peers[id].setLocalDescription(sdp);
            return sdp;
        }).then(sdp => {
            resolve(sdp);
        })
    })
}

//send sdp answer
const createSDPAnswer = async data => {
    let displayId = data.displayId;

    peers[displayId] = new RTCPeerConnection();
    peers[displayId].ontrack = e => {
        streams[displayId] = e.streams[0];

        let multiVideo = document.getElementById(`multiVideo-${displayId}`);
        multiVideo.srcObject = streams[displayId];
    }

    await peers[displayId].setRemoteDescription(data.sdp);
    let answerSdp = await peers[displayId].createAnswer();
    await peers[displayId].setLocalDescription(answerSdp);
    peers[displayId].onicecandidate = e => {
        if(!e.candidate){
            let reqData = {
                "eventOp": "SDP",
                "sdp": peers[displayId].localDescription,
                "roomId": data.roomId,
                "usage": "cam",
                "pluginId": data.pluginId,
                "userId": userId
            };

            sendData(reqData);
        }
    }
}

//퇴장 시, stream,peer 제거
const leaveParticipant = id => {
    document.getElementById(`multiVideo-${id}`).remove();
    document.getElementById(id).remove();

    if(streams[id]){
        streams[id].getVideoTracks()[0].stop();
        streams[id].getAudioTracks()[0].stop();
        streams[id] = null;
        delete streams[id];
    }

    if(peers[id]){
        peers[id].close();
        peers[id] = null;
        delete peers[id];
    }

}

/********************** button event **********************/
CreateRoomBtn.addEventListener('click', () => {
    host = true;
    let data = {
        "eventOp":"CreateRoom"
    }

    sendData(data);
});

RoomJoinBtn.addEventListener('click', () => {
    let data = {
        "eventOp":"RoomJoin",
        "roomId": roomIdInput.value
    }

    sendData(data);
});

SDPBtn.addEventListener('click', async () => {
    let sdp = await createSDPOffer(userId);

    let data = {
        "eventOp":"SDP",
        "pluginId": undefined,
        "roomId": roomIdInput.value,
        "sdp": sdp,
        "usage": "cam",
        "userId": userId,
        "host": host
    }
    sendData(data);
})
//sunny) share버튼을 누르면 다른 이용자는 share버튼을 누를 수 없다. 그리고 공유 예약을 누른자는 화면 공유가 된다.
ShareBtn.addEventListener('click', () => {
    console.log("buttonclick: "+userId)
    let data = {
        "eventOp":"SessionReserve",
        "userId": userId,
        "roomId": roomIdInput.value,
    }
    usage = "screen";
    sendData(data);
})
//sunny) 공유예약 취소
CancelBtn.addEventListener('click', () => {
    console.log("cancelclick: "+userId)
    let data = {
        "eventOp":"SessionReserveEnd",
        "roomId": roomIdInput.value,
        "userId": userId,
    }
    sendData(data);
})



/********************** event receive **********************/
clientIo.on("knowledgetalk", async data => {

    socketLog('receive', data);

    switch(data.eventOp || data.signalOp) {
        case 'CreateRoom':
            if(data.code == '200'){
                createRoom(data);
                CreateRoomBtn.disabled = true;
            }
            break;

        case 'RoomJoin':
            if(data.code == '200'){
                roomJoin(data);
                RoomJoinBtn.disabled = true;
                CreateRoomBtn.disabled = true;
            }
            break;

        case 'StartSession':
            startSession(data);
            break;

        case 'SDP':
            if(data.useMediaSvr == 'Y'){
                if(data.sdp && data.sdp.type == 'offer'){
                    createSDPAnswer(data);
                }
                else if(data.sdp && data.sdp.type == 'answer'){
                    peers[userId].setRemoteDescription(new RTCSessionDescription(data.sdp));
                }
            }
            break;
        case 'SessionReserve':
            if(data.code == '200'){
                //sunny) 공유예약이 잘 되었는 지 확인
                console.log("공유예약200");
                CancelBtn.disabled = false;
                ScreenBtn.disabled = false;
            }else{
                console.log("공유예약실패");
                CancelBtn.disabled = true;
            }
            break;
        case 'SessionReserveEnd':
            if(data.code == '200'){
                console.log("공유예약취소200");
                ShareBtn.disabled = false;
                CancelBtn.disabled = true;
                ScreenBtn.disabled = true;
            }
        case 'ReceiveFeed':
            receiveFeed(data)
            break;

        case 'Presence':
            if(data.action == 'exit'){
                leaveParticipant(data.userId)
            }
            break;

    }

});


const createRoom = data => {
    roomIdInput.value = data.roomId;

    //room id copy to clipboard
    roomIdInput.select();
    roomIdInput.setSelectionRange(0, 99999);
    document.execCommand("copy");

    alert('room id copied')
}

const roomJoin = data => {
    userId = data.userId;
}

const startSession = async data => {
    members = Object.keys(data.members);
    console.log("startsession:" +data.host)
    //3명 이상일 때, 다자간 통화 연결 시작
    if(data.useMediaSvr == 'Y'){
        for(let i=0; i<members.length; ++i){
            let user = document.getElementById(members[i]);
            if(!user){
                createVideoBox(members[i]);
            }
        }

        SDPBtn.disabled = false;
        ShareBtn.disabled = false;
        //CancelBtn.disabled = false;
        host = data.host;
    }
}

const receiveFeed = (data) => {
    data.feeds.forEach(result => {
        let data = {
            "eventOp":"SendFeed",
            "roomId": roomIdInput.value,
            "usage": "screen",
            "feedId": result.id,
            "display": result.display
        }

        sendData(data);
    })
}
