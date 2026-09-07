package com.safeher.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlin.math.sqrt

class SilentGuardianService : Service(), SensorEventListener {

    companion object {
        private const val TAG = "SilentGuardianService"
        const val CHANNEL_ID = "safeher_silent_guardian_channel"
        const val NOTIFICATION_ID = 4040
        const val ACTION_START = "com.safeher.ai.SILENT_GUARDIAN_START"
        const val ACTION_STOP = "com.safeher.ai.SILENT_GUARDIAN_STOP"

        var isRunning = false
            private set

        var listener: ((Double) -> Unit)? = null
    }

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null

    // Deliberate gesture detection variables
    private val SHAKE_THRESHOLD = 14.0 // m/s^2 above standard gravity
    private val WINDOW_MILLIS = 1500L // 1.5 seconds window for pattern
    private val MIN_INTERVAL_MILLIS = 150L // Minimum interval between peaks
    private val MAX_INTERVAL_MILLIS = 550L // Maximum interval between peaks
    private val COOLDOWN_MILLIS = 8000L // 8 seconds cooldown after trigger

    private var lastShakeTimestamp = 0L
    private var shakeTimestamps = ArrayList<Long>()
    private var lastTriggerTimestamp = 0L

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        if (action == ACTION_STOP) {
            stopMonitoring()
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundServiceWithNotification()
        startMonitoring()
        return START_STICKY
    }

    private fun startForegroundServiceWithNotification() {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡️ SafeHer Silent Guardian")
            .setContentText("Discreet gesture monitoring is active")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                    )
                } else {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                    )
                }
            } catch (e: Exception) {
                Log.w(TAG, "Foreground service type start error, falling back to standard: ${e.message}")
                startForeground(NOTIFICATION_ID, notification)
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        isRunning = true
    }

    private fun startMonitoring() {
        if (accelerometer != null) {
            sensorManager?.registerListener(
                this,
                accelerometer,
                SensorManager.SENSOR_DELAY_UI
            )
            Log.d(TAG, "Accelerometer listener registered successfully")
        } else {
            Log.w(TAG, "Accelerometer sensor not found on this device")
        }
    }

    private fun stopMonitoring() {
        sensorManager?.unregisterListener(this)
        isRunning = false
        Log.d(TAG, "Accelerometer listener unregistered")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val now = System.currentTimeMillis()

        // 1. Check cooldown period
        if (now - lastTriggerTimestamp < COOLDOWN_MILLIS) {
            return
        }

        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        // Calculate dynamic acceleration magnitude subtracting standard gravity (~9.81 m/s^2)
        val magnitude = sqrt((x * x + y * y + z * z).toDouble())
        val delta = kotlin.math.abs(magnitude - SensorManager.GRAVITY_EARTH)

        if (delta > SHAKE_THRESHOLD) {
            // Check interval from last recorded peak
            if (lastShakeTimestamp == 0L || (now - lastShakeTimestamp in MIN_INTERVAL_MILLIS..MAX_INTERVAL_MILLIS)) {
                shakeTimestamps.add(now)
                lastShakeTimestamp = now
            } else if (now - lastShakeTimestamp > MAX_INTERVAL_MILLIS) {
                // Pattern broken by too long of a delay: reset pattern
                shakeTimestamps.clear()
                shakeTimestamps.add(now)
                lastShakeTimestamp = now
            }

            // Clean old timestamps outside the window
            shakeTimestamps.removeAll { now - it > WINDOW_MILLIS }

            // Pattern requires at least 3 deliberate direction changes within window
            if (shakeTimestamps.size >= 3) {
                Log.i(TAG, "Deliberate shake gesture verified! Peak count: ${shakeTimestamps.size}")
                lastTriggerTimestamp = now
                shakeTimestamps.clear()
                lastShakeTimestamp = 0L

                // Subtle in-pocket haptic feedback (2 short pulses)
                vibrateDiscreetly()

                // Notify module/listeners
                listener?.invoke(delta)
            }
        }
    }

    private fun vibrateDiscreetly() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                val vibrator = vibratorManager?.defaultVibrator
                val effect = VibrationEffect.createWaveform(longArrayOf(0, 100, 100, 100), -1)
                vibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(longArrayOf(0, 100, 100, 100), -1)
                    vibrator?.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(longArrayOf(0, 100, 100, 100), -1)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Haptic feedback error: ${e.message}")
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onDestroy() {
        stopMonitoring()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SafeHer Silent Guardian",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifies when Silent Guardian discreet gesture monitoring is active"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
