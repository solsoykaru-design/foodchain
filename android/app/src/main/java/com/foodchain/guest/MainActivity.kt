package com.foodchain.guest

import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(SocialAuthPlugin::class.java)
    }
}
