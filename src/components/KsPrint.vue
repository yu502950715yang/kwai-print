<template>
  <div class="print-container">
    <h1 class="title">{{ msg }}</h1>

    <el-card class="status-card">
      <div class="status-content">
        <div class="status-info">
          <el-tag :type="kwaiPrintStatus ? 'success' : 'danger'" class="status-tag">
            {{ kwaiPrintStatus ? '已连接' : '未连接' }}
          </el-tag>
          <span class="status-text">快手打印插件状态</span>
        </div>
        <div class="button-group">
          <el-button type="primary" v-if="!kwaiPrintStatus" @click="connect" :loading="currentRetry > 0">
            {{ currentRetry > 0 ? `正在重连(${currentRetry})` : '连接' }}
          </el-button>
          <el-button type="danger" v-else @click="close">断开</el-button>
          <el-button type="info" @click="getPrinterList" :disabled="!kwaiPrintStatus">
            <el-icon><Refresh /></el-icon>刷新打印机
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="printer-card">
      <template #header>
        <div class="card-header">
          <span>打印机列表</span>
          <span class="printer-count" v-if="printerList.length > 0">共 {{ printerList.length }} 台</span>
        </div>
      </template>
      <el-empty v-if="printerList.length === 0" description="暂无打印机" />
      <el-table v-else :data="printerList" style="width: 100%" :stripe="true" :border="true">
        <el-table-column prop="name" label="打印机名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" size="small" @click="print(scope.row)" :disabled="!kwaiPrintStatus">
              <el-icon><Printer /></el-icon>打印
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Refresh } from '@element-plus/icons-vue'
import { connectKsPrinter } from '../utils/ksPrinter'

defineProps({
  msg: String,
})

// 快手打印插件连接状态
const kwaiPrintStatus = ref(false);
// 存储打印机列表数据
const printerList = ref([]);
// 当前重试次数
const currentRetry = ref(0)

// 创建快手插件实例
const ksWs = connectKsPrinter({
  maxRetries: 3,
  retryInterval: 3000,
})

// 监听连接事件
ksWs.on('open', () => {
  kwaiPrintStatus.value = true;
})

// 监听关闭事件
ksWs.on('close', () => {
  kwaiPrintStatus.value = false;
  printerList.value = [];
})

// 监听重连事件
ksWs.on('reconnecting', (count) => {
  currentRetry.value = count
})

// 监听获取打印机列表事件
ksWs.on('getPrinters', (data) => {
  printerList.value = data.printers
})

// 监听打印事件
ksWs.on('print', (data) => {
  if (data.status == 'success') {
    ElMessage({
      message: '打印任务已发送',
      type: 'success',
    });
  } else {
    ElMessage({
      message: '打印失败: ' + data.msg,
      type: 'error',
    });
  }
})

// 监听打印回调事件
ksWs.on('notifyPrintResult', (data) => {
  ElMessage({
    message: '打印任务已完成',
    type: 'success',
  });
})

// 监听错误事件
ksWs.on('error', (error) => {
  ElMessage.error('快手打印插件连接失败')
})

// 获取打印机列表
const getPrinterList = () => {
  if (!ksWs.isConnected()) {
    ElMessage.error('快手打印插件连接失败')
    return;
  }
  var data = {
    "cmd": "getPrinters",
    "requestID": "123458976",
    "version": "1.0"
  }
  ksWs.send(data);
}

// 连接打印插件
const connect = () => {
  ksWs.connect()
}

// 关闭连接打印插件
const close = () => {
  ksWs.close(true)
}

// 发送打印数据
const print = (row) => {
  var printData = {
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
  ksWs.send(printData);
}

onMounted(() => {
  if (!ksWs.isConnected()) {
    ksWs.connect()
  }
})

onBeforeUnmount(() => {
  ksWs.close(true)
})

</script>

<style scoped>
.print-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title {
  text-align: center;
  margin-bottom: 30px;
  color: #c2c1c1;
  font-size: 24px;
  font-weight: bold;
}

.status-card, .printer-card {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
}

.status-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f1f1f1;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-tag {
  min-width: 70px;
  text-align: center;
  padding: 4px 8px;
  border-radius: 4px;
}

.status-text {
  font-size: 14px;
  color: #666;
}

.button-group {
  display: flex;
  gap: 10px;
}

.printer-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f1f1f1;
}

.printer-count {
  font-size: 14px;
  color: #666;
}

.el-table {
  margin-top: 16px;
}

.el-table th, .el-table td {
  padding: 12px;
}

.el-table th.is-leaf {
  background-color: #f1f1f1;
}

.el-empty {
  padding: 40px 0;
}

.el-empty__description {
  font-size: 14px;
  color: #999;
}
</style>