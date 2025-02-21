<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <p>
      快手打印插件状态: {{ kwaiPrintStatus }}
      <el-button type="primary" v-if="!kwaiPrintStatus" @click="connectWebStocket">连接</el-button>
      <el-button type="danger" v-else @click="closeWebStocket">断开</el-button>
    </p>
    <!-- 添加重连状态提示 -->
    <p v-if="!kwaiPrintStatus && currentRetry > 0" type="warning" :closable="false">
      正在尝试第 {{ currentRetry }} 次重新连接...
    </p>

    <el-button @click="getPrinterList">获取打印机列表</el-button>
  </div>

  <el-card style="width: 500px;">
    <el-table :data="printerList" style="width: 100%">
      <el-table-column prop="name" label="打印机名称" />
      <el-table-column prop="oper" label="操作">
        <template #default="scope">
          <el-button type="primary" @click="print(scope.row)">打印</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { el } from 'element-plus/es/locales.mjs';
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

defineProps({
  msg: String,
})

// 快手打印插件连接状态
const kwaiPrintStatus = ref(false);
const ws = ref(null);
const printerList = ref([]);
// 新增重连控制变量
const reconnectTimer = ref(null)
// 标记是否手动关闭
const manualClose = ref(false)
// 当前重试次数
const currentRetry = ref(0)

onMounted(() => {
  connectWebStocket()
})

onBeforeUnmount(() => {
  manualClose.value = true
  clearTimeout(reconnectTimer.value)
  if (ws.value) {
    ws.value.close()
  }
})

// 建立WebStocket连接
const connectWebStocket = () => {
  manualClose.value = false
  clearTimeout(reconnectTimer.value) // 清除之前的定时器

  ws.value = new WebSocket('ws://localhost:16888/ks/printer');

  ws.value.onopen = () => {
    kwaiPrintStatus.value = true;
    currentRetry.value = 0 // 重置重试计数器
    console.log('快手打印插件连接成功');
  }

  ws.value.onmessage = (event) => {
    console.log('快手打印插件返回信息: ', event.data);
    var returnData = JSON.parse(event.data);
    if (returnData.cmd == 'getPrinters') {
      console.log('获取打印机列表成功: ', returnData.printers);
      printerList.value = returnData.printers;
    } else if (returnData.cmd == 'print') {
      if (returnData.status == 'success') {

      } else {
        ElMessage({
          message: '打印失败: ' + returnData.msg,
          type: 'error',
          plain: true,
        });
      }
    } else if (returnData.cmd == 'notifyPrintResult') {
      //打印完成回调通知
      console.log('打印完成回调通知: ', returnData.msg);
    } else {
      ElMessage({
        message: '未知返回信息: ' + event.data,
        type: 'warning',
        plain: true,
      });
    }
  }

  ws.value.oneerror = (event) => {
    kwaiPrintStatus.value = false
    printerList.value = [];
    console.log('快手打印插件连接失败: ', event);
    scheduleReconnect()
  }

  ws.value.onclose = () => {
    kwaiPrintStatus.value = false;
    printerList.value = [];
    console.log('快手打印插件连接关闭');
    // 非手动关闭时触发重连
    if (!manualClose.value) {
      console.log('连接意外断开，准备重连...')
      scheduleReconnect()
    }
  }
}

// 新增重连调度方法
const scheduleReconnect = () => {
  // if (currentRetry >= maxRetryCount) {
  //   console.warn(`已达到最大重试次数（${maxRetryCount}次），停止重连`)
  //   return
  // }

  console.log('scheduleReconnect执行重连方法')
  currentRetry.value++
  reconnectTimer.value = setTimeout(() => {
    console.log(`正在进行第 ${currentRetry.value} 次重连...`)
    connectWebStocket()
  }, 3000) // 3秒重连间隔
}

// 关闭webstocket
const closeWebStocket = () => {
  manualClose.value = true // 标记为手动关闭
  if (ws.value) {
    ws.value.close();
  }
}

const getPrinterList = () => {
  if (!kwaiPrintStatus.value) {
    console.log('快手打印插件未连接');
    return;
  }
  var data = {
    "cmd": "getPrinters",
    "requestID": "123458976",
    "version": "1.0"
  }
  // 转换成json字符串
  data = JSON.stringify(data);
  ws.value.send(data);
}

const print = (row) => {
  var data = {
    "cmd": "print",
    "requestID": "123458976",
    "version": "1.0",
    "task": {
      "taskID": "7293666",
      "printer": row.name,
      "preview": false,
      "firstDocumentNumber": 10,
      "totalDocumentCount": 100,
      "documents": [{
        "documentID": "0123456789",
        "waybillCode": "SF1236547356",
        "ksOrderFlag": true,
        "contents": [{
          "addData": {
            "senderInfo": {
              "address": {
                "cityName": "南京市",
                "countryCode": "CHN",
                "detailAddress": "软件大道10号华为南研所E区",
                "districtName": "雨花台区",
                "provinceName": "江苏省",
                "streetName": "xxx街道"
              },
              "contact": {
                "mobile": "13282160693",
                "name": "快手"
              }
            }
          },
          "encryptedData": "rU904rj6UH2oqfSUb43+Z+XlOkZaULeerkScS5xbmfjZC78uvsMTa3g6l33hRAz/srsk0TObjJaJI5n4tAPV1uv7szIPQGPDhwD6MK+zvTVIfuQCMC8p+cUB5S4FmqDhNE45LRVAlaoaI5YK8QmWK1WorhwnPxOFH4Ws/ApobtzDLDJaW6uu1AMEdAejEhRTWL3B1fRhhcDxc3gX+DZF9jJUB++fb9JZqmocWRu0Fvi/b1BokQx7Xt/N+FpJVRI0//NNUQ9b/W4tqGFIbf2IM/Ez1S5hBru5gKGdFzs99ZgCKqtWa0DnOzrZDXroU1mhurtlulE8QbipInu63fkIwn3h9ZSK0sMyV5Jrk5x3MIJDHeW9pc/Tw4TnKTAU134jl+GbbpYysa0+jBARWRjombeKIFSVfp/zgp15jClClUU1Nz4alTi22LimY2qteQRG6G/rCHiYxPoBRdrtqZZxNSdnKG5yjSdtA2CEL1DJNg1QkFVSSsOuqcHLdrKl6oMR+aUN6wM3GQikmKSU/CH4hWCCXxFaJXvBYoSxZ63GrM/d+l6D4+9+rCxHJoEVsa2E1TMHLUOnN6CweSM+45lcBK19bbCUJDyky6nb1NbxrZGYhmfkrNzE2GN+Cz4iTAgxJlQxd1gVvS4v5nB7qNfb0Uhy9NTopdumxOS7NXFFg3RFdBfAJ0nLGnxECUvUihBC3pwsLGimrUnIF4174m6J6Ga6cQE+Pp1LXgtKf5zWJdWHkm2vQhazcAsQC8JJZFb1ESp1vIAvpy0d0YmGrLLzxWNciHlOa7vguFCVF3UbTFe8r1Mxyym9rqNrZDXWRtBija9yeliMERVFuOTRjlc0PVAzveexQmuD4ESTzMZPtbO0jos1EITKhHcV35Na7E4I7bEe3L2u5yuFuzDA5cc8OA8v761+xOI70bGXUwvFO2kCCiUFEzI9ksLIDTtydBTA94lf4MYH6m0ziRmAhAgcwm5QJFd2G4JzpFIK4+dLuEZamrYUcnHmWzDIg+HYIXh6g3S2maFU7dUtwYoerptOTiVg8FxRlUTx30NDTgjm7ll8vEJXHj7yd/gAO3Vm9P54OSMv8w+pzX3gtCkvthrkjlToT1jMRNJyuJAeSBf5jruzYLS68inlSE/ehT10zhaiBvaCqojZZ2Ux0JQGhbR/nQ==",
          "signature": "19d6f7759487e556ddcdd3d499af087080403277b7deed1a951cc3d9a93c42a7e22ccba94ff609976c5d3ceb069b641f541bc9906098438d362cae002dfd823a8654b2b4f655e96317d7f60eef1372bb983a4e3174cc8d321668c49068071eaea873071ed683dd24810e51afc0bc925b7a2445fdbc2034cdffb12cb4719ca6b7",
          "key": "dfsjkhhfksjdhfkfksdfjkf",
          "templateURL": "https://s1-11586.kwimgs.com/kos/nlav11586/EBST-EBSTO6.xml",      // 这个是标准面单的模板链接
          "ver": "waybill_print_secret_version_1"
        },
        {
          "customData": {
            "value": "测试字段值需要配合自定义区变量名"
          },
          "templateURL": "https://s2-11586.kwimgs.com/kos/nlav11586/template/custom/EBCT-EBCTO20.xml"   // 这个是自定义的模板链接
        }
        ]
      }]
    }
  }
  data = JSON.stringify(data);
  ws.value.send(data);
}
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
