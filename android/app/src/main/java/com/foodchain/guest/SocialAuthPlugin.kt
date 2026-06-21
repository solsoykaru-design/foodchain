package com.foodchain.guest

import android.content.Intent
import android.widget.Toast
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.vk.api.sdk.VK
import com.vk.api.sdk.auth.VKAccessToken
import com.vk.api.sdk.auth.VKAuthCallback
import com.vk.api.sdk.auth.VKScope
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

@CapacitorPlugin(name = "SocialAuth")
class SocialAuthPlugin : Plugin() {

    private var googleSignInClient: GoogleSignInClient? = null

    override fun load() {
        VK.initialize(activity.applicationContext)
    }

    @PluginMethod
    fun loginWithGoogle(call: PluginCall) {
        val webClientId = call.getString("webClientId") ?: ""

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build()

        googleSignInClient = GoogleSignIn.getClient(activity, gso)

        val signInIntent = googleSignInClient?.signInIntent
        if (signInIntent != null) {
            startActivityForResult(call, signInIntent, "googleResult")
        } else {
            call.reject("Failed to create Google Sign-In intent")
        }
    }

    @ActivityCallback
    private fun googleResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            val data: Intent? = result.data
            try {
                val task = GoogleSignIn.getSignedInAccountFromIntent(data)
                val account = task.getResult(ApiException::class.java)
                val email = account.email ?: ""
                val name = account.displayName ?: email

                activity.runOnUiThread {
                    Toast.makeText(activity, "Google: $email", Toast.LENGTH_LONG).show()
                }

                val ret = JSObject()
                ret.put("email", email)
                ret.put("name", name)
                call.resolve(ret)
            } catch (e: ApiException) {
                call.reject("Google Sign-In failed: ${e.statusCode}")
            }
        } else {
            call.reject("Google Sign-In cancelled")
        }
    }

    private var pendingVkCall: PluginCall? = null

    @PluginMethod
    fun loginWithVk(call: PluginCall) {
        pendingVkCall = call
        val scopes = listOf(VKScope.EMAIL, VKScope.WALL, VKScope.FRIENDS)
        VK.login(activity, scopes)
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val call = pendingVkCall
        if (call != null) {
            VK.onActivityResult(requestCode, resultCode, data, object : VKAuthCallback {
                override fun onLogin(token: VKAccessToken) {
                    val userId = token.userId
                    val email = token.email ?: ""

                    thread {
                        var displayName = "VK User $userId"
                        try {
                            val url = URL("https://api.vk.com/method/users.get?access_token=${token.accessToken}&v=5.131")
                            val conn = url.openConnection() as HttpURLConnection
                            conn.requestMethod = "GET"
                            conn.connectTimeout = 5000
                            conn.readTimeout = 5000
                            val reader = BufferedReader(InputStreamReader(conn.inputStream))
                            val response = reader.readText()
                            reader.close()
                            val usersResponse = Gson().fromJson(response, VKUsersResponse::class.java)
                            if (usersResponse.response != null && usersResponse.response.isNotEmpty()) {
                                val user = usersResponse.response[0]
                                displayName = "${user.firstName} ${user.lastName}".trim()
                            }
                        } catch (_: Exception) {
                            // fallback
                        }

                        val finalName = displayName
                        activity.runOnUiThread {
                            Toast.makeText(activity, "VK: $finalName, ID: $userId", Toast.LENGTH_LONG).show()
                            val ret = JSObject()
                            ret.put("id", userId.toString())
                            ret.put("email", email)
                            ret.put("name", finalName)
                            call.resolve(ret)
                        }
                    }
                }

                override fun onLoginFailed(errorCode: Int) {
                    call.reject("VK Login failed: code $errorCode")
                }
            })
            pendingVkCall = null
        }
        super.handleOnActivityResult(requestCode, resultCode, data)
    }

    data class VKUser(
        @SerializedName("first_name") val firstName: String,
        @SerializedName("last_name") val lastName: String,
        val id: Long
    )

    data class VKUsersResponse(
        val response: List<VKUser>?
    )
}
