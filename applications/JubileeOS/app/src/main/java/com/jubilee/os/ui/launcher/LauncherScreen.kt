package com.jubilee.os.ui.launcher

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jubilee.os.R
import com.jubilee.os.ui.theme.JubileeCyan
import com.jubilee.os.ui.theme.JubileeGold
import com.jubilee.os.ui.theme.JubileeBlack
import com.jubilee.os.ui.theme.JubileeSurfaceContainer

/**
 * Main launcher screen for JubileeOS
 * JubileeBible (JSV) portal design - matches screenshot exactly
 */
@Composable
fun LauncherScreen() {
    var showAppDrawer by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    val context = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(JubileeBlack)
    ) {
        // Main content - vertically and horizontally centered
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp)
                .padding(bottom = 80.dp), // Leave space for bottom nav
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Jubilee Avatar with cyan border
            JubileeAvatar()

            Spacer(modifier = Modifier.height(19.dp))

            // JubileeBible (JSV) branding text
            JubileeBibleHeader()

            Spacer(modifier = Modifier.height(32.dp))

            // Search box
            JubileeSearchBox(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(0.85f)
            )

        }

        // Bottom navigation bar - fixed at bottom
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        ) {
            BottomNavBar(
                onAppDrawerClick = { showAppDrawer = true }
            )
        }

        // App Drawer Overlay
        AnimatedVisibility(
            visible = showAppDrawer,
            enter = fadeIn() + slideInVertically { it },
            exit = fadeOut() + slideOutVertically { it }
        ) {
            AppDrawer(
                onDismiss = { showAppDrawer = false }
            )
        }
    }
}

/**
 * Jubilee Avatar with cyan circular border
 */
@Composable
fun JubileeAvatar() {
    Box(
        modifier = Modifier
            .size(140.dp)
            .clip(CircleShape)
            .border(
                width = 6.dp,
                color = JubileeCyan,
                shape = CircleShape
            )
            .background(JubileeSurfaceContainer),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.jubilee_avatar),
            contentDescription = "Jubilee Avatar",
            modifier = Modifier
                .size(132.dp)
                .clip(CircleShape),
            contentScale = ContentScale.Crop
        )
    }
}

/**
 * JubileeBible (JSV) branded header text
 */
@Composable
fun JubileeBibleHeader() {
    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "Jubilee",
            fontSize = 40.sp,
            fontWeight = FontWeight.Normal,
            letterSpacing = 0.5.sp,
            color = Color.White
        )
        Text(
            text = "Bible",
            fontSize = 40.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = Color.White
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "(JSV)",
            fontSize = 40.sp,
            fontWeight = FontWeight.Normal,
            letterSpacing = 0.sp,
            color = Color.White.copy(alpha = 0.9f)
        )
    }
}

/**
 * Search box - editable text field with medium gray background
 */
@Composable
fun JubileeSearchBox(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val mediumGray = Color(0xFF4A4A4A)

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(28.dp))
            .background(mediumGray)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Editable text field
            androidx.compose.foundation.text.BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier
                    .weight(1f)
                    .padding(vertical = 12.dp),
                textStyle = MaterialTheme.typography.bodyLarge.copy(
                    color = Color.White
                ),
                singleLine = true,
                decorationBox = { innerTextField ->
                    Box {
                        if (query.isEmpty()) {
                            Text(
                                text = "What do you want to know?",
                                style = MaterialTheme.typography.bodyLarge,
                                color = Color.White.copy(alpha = 0.5f)
                            )
                        }
                        innerTextField()
                    }
                }
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Send/Submit button with arrow
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(JubileeGold)
                    .clickable { /* Submit query */ },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowForward,
                    contentDescription = "Submit",
                    tint = JubileeBlack,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

/**
 * Bottom navigation bar with app drawer button
 */
@Composable
fun BottomNavBar(
    onAppDrawerClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clip(RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp))
            .background(JubileeSurfaceContainer),
        contentAlignment = Alignment.Center
    ) {
        // App Drawer Button (orange/gold grid icon)
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(JubileeGold)
                .clickable(onClick = onAppDrawerClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Apps,
                contentDescription = "App Drawer",
                tint = JubileeBlack,
                modifier = Modifier.size(28.dp)
            )
        }
    }
}
