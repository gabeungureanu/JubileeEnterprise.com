/**
 * EmailBodyViewer — Renders email HTML body using WebView.
 *
 * Writes HTML to a temp file and loads via file:// URI so the WebView
 * has a real origin with full network access for loading external images.
 *
 * Dark mode is handled via regex color adaptation in emailHtmlProcessor
 * (matching the web frontend approach) — no CSS filter inversion needed.
 * Link clicks intercepted via JS postMessage.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import { Colors } from '../../constants/colors';

interface EmailBodyViewerProps {
  html: string;
}

function buildDocument(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
  <style>
    * { box-sizing: border-box; }
    html {
      margin: 0;
      padding: 0;
      background-color: ${Colors.background};
      min-height: 100%;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: ${Colors.textPrimary};
      background-color: ${Colors.background};
      word-wrap: break-word;
      overflow-wrap: break-word;
      -webkit-text-size-adjust: 100%;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
    }
    table {
      max-width: 100% !important;
    }
    a { color: #4da6ff; }
    pre, code {
      white-space: pre-wrap;
      word-wrap: break-word;
      max-width: 100%;
    }
    blockquote {
      margin: 8px 0;
      padding-left: 12px;
      border-left: 3px solid #555;
      color: #aaa;
    }
  </style>
</head>
<body>
  ${html}
  <script>
    document.addEventListener('click', function(e) {
      var a = e.target;
      while (a && a.tagName !== 'A') a = a.parentElement;
      if (a && a.href && !a.href.startsWith('javascript:')) {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'link', url: a.href }));
      }
    }, true);
  </script>
</body>
</html>`;
}

let fileCounter = 0;

export function EmailBodyViewer({ html }: EmailBodyViewerProps) {
  const documentHtml = useMemo(() => buildDocument(html), [html]);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  // Write HTML to a temp file so WebView loads from file:// origin.
  useEffect(() => {
    try {
      const fileName = `email_${Date.now()}_${++fileCounter}.html`;
      const file = new File(Paths.cache, fileName);
      file.write(documentHtml);
      fileRef.current = file;
      setFileUri(file.uri);
    } catch {
      setFileUri(null);
    }

    return () => {
      try {
        if (fileRef.current?.exists) {
          fileRef.current.delete();
        }
      } catch {
        // ignore cleanup errors
      }
      fileRef.current = null;
      setFileUri(null);
    };
  }, [documentHtml]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'link' && data.url) {
        Linking.openURL(data.url).catch(() => { });
      }
    } catch {
      // ignore
    }
  }, []);

  if (!fileUri) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: fileUri }}
      style={{ flex: 1, backgroundColor: Colors.background }}
      scrollEnabled
      showsHorizontalScrollIndicator={false}
      onMessage={handleMessage}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      textZoom={100}
      cacheEnabled
      nestedScrollEnabled
      setSupportMultipleWindows={false}
    />
  );
}
