/*
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

const videoElement = document.querySelector('video');
const videoSelect = document.querySelector('select#videoSource');
const frequencySelect = document.querySelector('select#frequency');
const constraintSelect = document.querySelector('select#constraint');
let streaming = false;
// let videoInput = document.getElementById('videoInput');
const startAndStop = document.getElementById('startAndStop');
const canvas = document.getElementById("preview-canvas");
// const canvasContext = canvas.getContext('2d');

// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;

// videoElement.width = window.innerWidth;
// videoElement.height = window.innerHeight;

const selectors = [videoSelect];

function gotDevices(deviceInfos) {
  // 应该能找到数据
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);

  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });

  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      //
      select.value = values[selectorIndex];
    }
  });

}

//先枚举所有摄像头
navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

function gotStream(stream) {
  window.stream = stream; // make stream available to console
  videoElement.srcObject = stream;
  
  //开启是需要时间的，videoElement并不一定有响应

  //没有play是否会开启？ 在标签中设为autoplay就可以了
  videoElement.play();

  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

// videoSelect.onchange = start;
// start();


startAndStop.addEventListener('click', () => {
  if (!streaming) {
    startDetect();
  } else {
    stopDetect();
  }
});

function startDetect() {
  streaming = true;
  startAndStop.innerText = 'Stop';
  //先开启视频
  const videoSource = videoSelect.value;
  const constraints = {
    video: {
      width: { ideal: constraintSelect.value },
      // height: { ideal: videoElement.height },
      facingMode: "environment",//facingMode: 'user'
      deviceId: videoSource ? { exact: videoSource } : undefined
    },
    audio: false
  };
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).then(launchVideo).catch(handleError);
  //开启检测

}

function stopDetect() {
  streaming = false;
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  // canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  // videoElement.stop();
  startAndStop.innerText = 'Start';
}

constraintSelect.onchange = constraintChange;

//可以实时改变 但是也要停止streaming再开启，否则
function constraintChange(e) {
  // span输出宽度
  // widthOutput.textContent = e.target.value;
  // streaming = false;
  // videoElement.width = e.target.value;
  const track = window.stream.getVideoTracks()[0];
  let constraints = { width: { exact: e.target.value } };

  console.log('applying ' + JSON.stringify(constraints));
  track.applyConstraints(constraints)
    .then(() => {
      console.log('applyConstraint success');
    })
    .catch(err => {
      alert('applyConstraints'+ err.name);
    });
}



function launchVideo() {
  //   canvas.width = window.innerWidth;
  // canvas.height = window.innerHeight;

  // videoElement.width = window.innerWidth;
  // videoElement.height = window.innerHeight;

  let wr = new cv.wechat_qrcode_WeChatQRCode(
    "wechat_qrcode/detect.prototxt",
    "wechat_qrcode/detect.caffemodel",
    "wechat_qrcode/sr.prototxt",
    "wechat_qrcode/sr.caffemodel"
  );
  const out = new cv.MatVector();

  //使用video元素的视频宽度和高度，需要延迟到视频完全打开
  let width = videoElement.videoWidth;
  let height = videoElement.videoHeight;

  videoElement.width= constraintSelect.value;
  videoElement.height = height;
  //
  let src = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC4);
  // let dst = new cv.Mat(videoElement.height, videoElement.width, cv.CV_8UC1);
  let cap = new cv.VideoCapture(videoElement);

  const FPS = 5;
  //这个帧率不知道够不够，处理一张照片平均使用150ms，也就6-7张一秒
  //帧数设为5才对

  // navigator.mediaDevices.getUserMedia({
  //     video: {
  //         width: { exact: video.width },
  //         height: { exact: video.height },
  //         facingMode: 'environment'
  //     }, audio: false
  // }).then(function (stream) {
  //     video.srcObject = stream;
  //     video.play();
  // }).catch(function (err) {
  //     console.log('Camera Error: ' + err.name + ' ' + err.message);
  // });

  function processVideo() {
    try {
      //streaming存在的意义是无限循环中的一种中断标识
      if (!streaming) {
        // clean and stop.
        src.delete();
        // dst.delete();
        //如何注销自己的回调
        return;
      }
      cap.read(src);
      cv.imshow('preview-canvas', src)

      let begin = Date.now();
      // start processing.
      // var inputImg= cap.read(src);
      // var inputImg = dst;
      const results = wr.detectAndDecode(src, out);
      // cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
      // cv.imshow('canvasOutput', dst);
      let i = 0
      let arr = []
      while (i < results.size()) {
        arr.push(results.get(i++))
      }
      results.delete()

      const rects = []
      for (let j = 0; j < out.size(); j += 1) {

        let rectPoint = cv.boundingRect(out.get(j))
        rects.push(rectPoint)
        // 左上角点
        let point1 = new cv.Point(rectPoint.x, rectPoint.y);
        // 右下角点
        let point2 = new cv.Point(rectPoint.x + rectPoint.width, rectPoint.y + rectPoint.height);

        let color = new cv.Scalar(0, 255, 0, 255);
        //画绿色框框
        // cv.rectangle(src, point1, point2, new cv.Scalar(0, 255, 0), 2, cv.LINE_AA, 0);
        cv.rectangle(src, point1, point2, color, 2);
        //在框框的边缘添加绿色文字
        cv.putText(src, arr[j], point1, cv.FONT_HERSHEY_SIMPLEX, 1, color, 2);
      }

      cv.imshow('preview-canvas', src)

      // document.querySelector('.result-count').textContent = `检测到 ${arr.length} 个二维码`
      // document.querySelector('.result-list').innerHTML = arr.join('<br />')
      // schedule the next one.
      let delay = 1000 / FPS - (Date.now() - begin);
      //通过定时器按照一定的频率执行函数
      setTimeout(processVideo, delay);
    } catch (err) {
      console.log(err);
    }
  };
  // schedule the first one.
  setTimeout(processVideo, 0);
};

// Helper for opencv.js (see below)
var Module = {
  preRun: [],
  postRun: [],
  onRuntimeInitialized: function () {
    console.log("Emscripten runtime is ready");
    if (window.cv instanceof Promise) {
      window.cv.then((target) => {
        window.cv = target;
        //console.log(cv.getBuildInformation());
        // launchDemo()
        // launchVideo()
        startAndStop.removeAttribute('disabled');
      })
    }
  },
  print: (function () {
    var element = document.getElementById('output');
    if (element) element.value = ''; // clear browser cache
    return function (text) {
      console.log(text);
      if (element) {
        element.value += text + "\n";
        element.scrollTop = element.scrollHeight; // focus on bottom
      }
    };
  })(),
  printErr: function (text) {
    console.error(text);
  },
  setStatus: function (text) {
    console.log(text);
  },
  totalDependencies: 0
};

Module.setStatus('Downloading...');
window.onerror = function (event) {
  Module.setStatus('Exception thrown, see JavaScript console');
  Module.setStatus = function (text) {
    if (text) Module.printErr('[post-exception status] ' + text);
  };
};
