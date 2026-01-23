package com.jubilee.os

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * JubileeOS Application
 *
 * A faith-focused Android launcher that transforms your device
 * into a spiritual companion for believers everywhere.
 *
 * Features:
 * - Bible reading and study
 * - Prayer journal and reminders
 * - Worship music player
 * - Ministry tools
 * - Parental controls for families
 */
@HiltAndroidApp
class JubileeOSApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: JubileeOSApplication
            private set
    }
}
