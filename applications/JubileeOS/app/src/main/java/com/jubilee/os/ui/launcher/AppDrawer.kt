package com.jubilee.os.ui.launcher

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.drawable.Drawable
import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilee.os.R
import com.jubilee.os.ui.theme.JubileeCyan
import com.jubilee.os.ui.theme.JubileeGold
import com.jubilee.os.ui.theme.JubileeBlack
import com.jubilee.os.ui.theme.JubileeSurfaceContainer
import com.jubilee.os.ui.theme.JubileeSurfaceContainerHigh

/**
 * JubileeOS App - custom app data for the drawer
 */
data class JubileeApp(
    val name: String,
    @DrawableRes val iconRes: Int,
    val packageName: String? = null // Optional for linking to real apps
)

/**
 * List of JubileeOS custom apps
 */
val jubileeApps = listOf(
    JubileeApp("Jubilee Bible", R.drawable.ic_app_jubilee_bible),
    JubileeApp("Bibleweb", R.drawable.ic_app_bibleweb),
    JubileeApp("Devotionals", R.drawable.ic_app_devotionals),
    JubileeApp("Upper Room", R.drawable.ic_app_upper_room),
    JubileeApp("JubileeVerse", R.drawable.ic_app_jubileeverse),
    JubileeApp("Scripture Memory", R.drawable.ic_app_scripture_memory),
    JubileeApp("Daily Bread", R.drawable.ic_app_daily_bread),
    JubileeApp("Sermons", R.drawable.ic_app_sermons),
    JubileeApp("Books", R.drawable.ic_app_books),
    JubileeApp("Good News", R.drawable.ic_app_good_news),
    JubileeApp("Testimony", R.drawable.ic_app_testimony),
    JubileeApp("Podcasts", R.drawable.ic_app_podcasts),
    JubileeApp("Radio", R.drawable.ic_app_radio),
    JubileeApp("Music Gospel", R.drawable.ic_app_music_gospel),
    JubileeApp("Vibes", R.drawable.ic_app_vibes),
    JubileeApp("JubiFlix", R.drawable.ic_app_jubiflix),
    JubileeApp("Church", R.drawable.ic_app_church),
    JubileeApp("Community", R.drawable.ic_app_communities),
    JubileeApp("Circles", R.drawable.ic_app_circles),
    JubileeApp("Round Table", R.drawable.ic_app_round_table),
    JubileeApp("Prayer Watch", R.drawable.ic_app_prayer_watch),
    JubileeApp("Faith Journal", R.drawable.ic_app_faith_journal),
    JubileeApp("Daily Habits", R.drawable.ic_app_daily_habits),
    JubileeApp("Faith Guard", R.drawable.ic_app_faith_guard),
    JubileeApp("Jubilee Paradox", R.drawable.ic_app_paradox),
    JubileeApp("Browser", R.drawable.ic_app_browser),
    JubileeApp("Camera", R.drawable.ic_app_camera),
    JubileeApp("Phone", R.drawable.ic_app_phone),
    JubileeApp("Contacts", R.drawable.ic_app_contacts),
    JubileeApp("Photos", R.drawable.ic_app_photos),
    JubileeApp("Files", R.drawable.ic_app_files),
    JubileeApp("Clock", R.drawable.ic_app_clock),
    JubileeApp("Calculator", R.drawable.ic_app_calculator),
    JubileeApp("Settings", R.drawable.ic_app_settings)
)

/**
 * Full-screen app drawer overlay with Jubilee styling
 * Shows JubileeOS custom apps in a grid layout
 */
@Composable
fun AppDrawer(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var searchQuery by remember { mutableStateOf("") }

    // Filter apps based on search
    val filteredApps = remember(searchQuery) {
        if (searchQuery.isEmpty()) {
            jubileeApps
        } else {
            jubileeApps.filter { it.name.contains(searchQuery, ignoreCase = true) }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(JubileeBlack.copy(alpha = 0.98f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            // Header with close button and search
            JubileeAppDrawerHeader(
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
                onClose = onDismiss
            )

            Spacer(modifier = Modifier.height(24.dp))

            // App Grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(4),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(filteredApps) { app ->
                    JubileeAppItem(
                        app = app,
                        onClick = {
                            // TODO: Launch app or show coming soon
                            onDismiss()
                        }
                    )
                }
            }
        }
    }
}

/**
 * Header with search bar and close button - Jubilee styled
 */
@Composable
fun JubileeAppDrawerHeader(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        // Close button row
        Box(
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.align(Alignment.CenterStart)
            ) {
                Text(
                    text = "All ",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold
                    ),
                    color = Color.White
                )
                Text(
                    text = "Apps",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold
                    ),
                    color = JubileeGold
                )
            }

            Box(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(JubileeSurfaceContainer)
                    .border(
                        width = 1.dp,
                        color = Color.White.copy(alpha = 0.1f),
                        shape = CircleShape
                    )
                    .clickable(onClick = onClose),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Close",
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Search bar with Jubilee styling
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(JubileeSurfaceContainer)
                .border(
                    width = 1.dp,
                    brush = Brush.horizontalGradient(
                        colors = listOf(
                            JubileeCyan.copy(alpha = 0.3f),
                            JubileeGold.copy(alpha = 0.2f)
                        )
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
                .padding(horizontal = 16.dp, vertical = 14.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search",
                    tint = JubileeCyan,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                BasicTextField(
                    value = searchQuery,
                    onValueChange = onSearchQueryChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(
                        color = Color.White
                    ),
                    decorationBox = { innerTextField ->
                        Box {
                            if (searchQuery.isEmpty()) {
                                Text(
                                    text = "Search apps...",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = Color.White.copy(alpha = 0.4f)
                                )
                            }
                            innerTextField()
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * Individual JubileeOS app item in the grid
 */
@Composable
fun JubileeAppItem(
    app: JubileeApp,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(4.dp)
    ) {
        // App icon with subtle shadow
        Box(
            modifier = Modifier
                .size(56.dp)
                .shadow(
                    elevation = 4.dp,
                    shape = CircleShape,
                    ambientColor = JubileeCyan.copy(alpha = 0.15f),
                    spotColor = JubileeCyan.copy(alpha = 0.2f)
                )
                .clip(CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = app.iconRes),
                contentDescription = app.name,
                modifier = Modifier.size(56.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // App name
        Text(
            text = app.name,
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.Medium
            ),
            color = Color.White.copy(alpha = 0.85f),
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(72.dp)
        )
    }
}

/**
 * App information for the drawer (for system apps if needed)
 */
data class AppInfo(
    val name: String,
    val packageName: String,
    val icon: Drawable?
)

/**
 * Get all installed launchable apps (kept for potential future use)
 */
fun getInstalledApps(context: Context): List<AppInfo> {
    val packageManager = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
    }

    val resolveInfoList: List<ResolveInfo> = packageManager.queryIntentActivities(intent, 0)

    return resolveInfoList
        .map { resolveInfo ->
            AppInfo(
                name = resolveInfo.loadLabel(packageManager).toString(),
                packageName = resolveInfo.activityInfo.packageName,
                icon = resolveInfo.loadIcon(packageManager)
            )
        }
        .sortedBy { it.name.lowercase() }
}

/**
 * Launch an app by package name
 */
fun launchApp(context: Context, packageName: String) {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
    launchIntent?.let {
        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(it)
    }
}
