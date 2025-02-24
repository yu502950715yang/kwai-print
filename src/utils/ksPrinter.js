import { debounce } from 'lodash'

/**
 * 快手打印组件webstock 
 * 快手文档地址 https://docs.qingque.cn/d/home/eZQA41D2h9LGUFaD26bC07e--?identityId=1oEFwmDizx5https:/
 * @param {*} options
 */
class KsPrinter {

    constructor(options = {}) {
        this.defaultOptions = {
            // 快手连接地址
            // url: 'ws://localhost:16888/ks/printer',
            url: 'wss://localhost:16889/ks/printer',
            //最大重连次数 设置为-1时 不限制重连次数
            maxRetries: 5,
            //重连间隔
            retryInterval: 3000,
            //是否自动重连
            autoConnect: true,
            // 心跳发送间隔（毫秒）25000
            heartbeatInterval: 25000,
            // 心跳响应超时时间
            heartbeatTimeout: 10000
        }

        // 合并配置
        this.options = { ...this.defaultOptions, ...options }

        // 内部状态
        this.ws = null
        // 重试次数
        this.retryCount = 0
        // 标记是否手动关闭
        this.manualClose = false
        this.eventHandlers = new Map()
        //定时器
        this.reconnectTimer = null
        //防抖
        this.debouncedSend = debounce(this._actualSend, 300);

        // 自动连接
        if (this.options.autoConnect) {
            this.connect()
        }

        // 心跳相关状态
        this.heartbeatTimer = null
        this.heartbeatTimeoutTimer = null

    }

    //连接 websocket
    connect() {
        // 先清理旧连接
        this.cleanupExistingConnection()

        this.manualClose = false
        this.ws = new WebSocket(this.options.url)

        // 绑定事件处理器
        this.bindEventHandlers()
    }

    // 绑定事件
    bindEventHandlers() {
        this.ws.onopen = (e) => this.handleOpen(e)
        this.ws.onmessage = (e) => this.handleMessage(e)
        this.ws.onerror = (e) => this.handleError(e)
        this.ws.onclose = (e) => this.handleClose(e)
    }

    // 清理旧连接
    cleanupExistingConnection() {
        if (this.ws) {
            // 移除旧连接的所有事件监听
            this.ws.onopen = null
            this.ws.onmessage = null
            this.ws.onerror = null
            this.ws.onclose = null

            // 直接关闭不触发事件
            try {
                this.ws.close(1000, 'Reconnect required')
            } catch (error) {
                console.warn('关闭旧连接时出错:', error)
            }

            this.ws = null
        }
    }

    //关闭连接
    close(immediate = false) {
        console.log('关闭触发')
        this.manualClose = immediate
        this.retryCount = 0
        this.clearTimers()

        if (this.ws) {
            if (immediate) {
                console.log('立即关闭连接')
                this.ws.close()
            } else {
                console.log('手动关闭连接')
                this.ws.close(1000, '手动关闭连接')
            }
        }
    }

    // 发送消息
    send(data) {
        if (this.isConnected()) {
            this.debouncedSend(data);
        }
    }

    // 实际发送的私有方法
    _actualSend(data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(payload);
    }

    //事件监听
    on(event, callback) {
        this.eventHandlers.set(event, callback)
    }

    //移除事件监听
    off(event) {
        this.eventHandlers.delete(event)
    }

    //状态检查
    isConnected() {
        return this.ws && this.ws?.readyState === WebSocket.OPEN
    }

    handleOpen() {
        this.retryCount = 0
        this.triggerEvent('open')
        this.startHeartbeat()
    }

    /**
     * 收到消息
     * 
     * 快手插件返回消息类型 data.cmd
     * pong 心跳响应 心跳直接返回字符串，其余类型需要解析json串
     * cmd = 'getPrinters' 获取打印机列表
     * cmd = 'print' 打印
     * cmd = 'notifyPrintResult' 打印完成通知
     * cmd = 'getClientInfo' 获取客户端版本信息
     * @param {返回的消息} event 
     * @returns 
     */
    handleMessage(event) {
        try {
            console.log('收到消息:', event.data)
            if (event.data === 'pong') {
                console.log('收到心跳响应')
                this.stopHeartbeatTimeout()
                return
            }
            const data = JSON.parse(event.data)
            this.triggerEvent('message', data)

            if (data.cmd) {
                this.triggerEvent(data.cmd, data)
            }
        } catch (error) {
            this.triggerEvent('error', error)
            console.error('解析消息失败:', error)
        }
    }

    handleError(error) {
        this.triggerEvent('error', error)
        console.error('WebSocket错误:', error)
        this.scheduleReconnect()
    }

    handleClose(event) {
        this.triggerEvent('close', event)
        this.scheduleReconnect()
    }



    // 重连逻辑
    scheduleReconnect() {
        clearTimeout(this.reconnectTimer)
        console.log(`触发重连：${this.retryCount + 1}`)
        if (!this.options.autoConnect) {
            console.log('关闭自动重连')
            this.ws.close(1000, 'Reconnect required')
            return
        }
        if (this.manualClose) {
            console.log('手动关闭，不重连')
            this.ws.close(1000, 'Reconnect required')
            return
        }
        if (this.options.maxRetries !== -1 && this.retryCount >= this.options.maxRetries) {
            console.warn('已达最大重连次数')
            this.ws.close(1000, 'Reconnect required')
            return
        }
        // 计算带指数退避的延迟
        const delay = this.calculateRetryDelay()
        console.log(`将在 ${delay}ms 后尝试第 ${this.retryCount + 1} 次重连`)
        this.retryCount++
        this.triggerEvent('reconnecting', this.retryCount)

        // setTimeout 只会执行一次
        this.reconnectTimer = setTimeout(() => {
            this.connect()
        }, delay)
    }

    // 指数退避计算
    calculateRetryDelay() {
        const baseDelay = this.options.retryInterval
        const maxDelay = 30000 // 30秒上限
        return Math.min(baseDelay * Math.pow(2, this.retryCount), maxDelay)
    }

    //触发事件
    triggerEvent(event, ...args) {
        const handler = this.eventHandlers.get(event)
        if (handler) {
            try {
                handler(...args)
            } catch (error) {
                console.error(`处理事件${event}时发生错误:`, error)
            }
        }
    }

    // 清理定时器
    clearTimers() {
        clearTimeout(this.reconnectTimer)
        this.stopHeartbeat()
        this.stopHeartbeatTimeout()
    }

    // 心跳方法
    startHeartbeat() {
        //清除旧的定时器
        this.stopHeartbeat()

        this.heartbeatTimer = setInterval(() => {
            // 发送心跳消息
            this.send('ping')

            // 设置超时定时器
            this.startHeartbeatTimeout()
        }, this.options.heartbeatInterval)
    }

    startHeartbeatTimeout() {
        this.stopHeartbeatTimeout()
        this.heartbeatTimeoutTimer = setTimeout(() => {
            console.warn('心跳响应超时，主动断开连接')
            this.close(true) // 强制关闭
            this.scheduleReconnect()
        }, this.options.heartbeatTimeout)
    }

    stopHeartbeat() {
        clearInterval(this.heartbeatTimer)
        this.stopHeartbeatTimeout()
    }

    stopHeartbeatTimeout() {
        clearTimeout(this.heartbeatTimeoutTimer)
    }
}

// 导出一个实例（单例模式）
let ksPrinterinstance = null
export const connectKsPrinter = (options) => {
    if (!ksPrinterinstance) {
        ksPrinterinstance = new KsPrinter(options)
    }
    return ksPrinterinstance
}