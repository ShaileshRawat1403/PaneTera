#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char *SERVICE = "ai.panetera.rig";

static void fail(const char *message, OSStatus status) {
  CFStringRef detail = SecCopyErrorMessageString(status, NULL);
  char buffer[512] = {0};
  if (detail && CFStringGetCString(detail, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
    fprintf(stderr, "%s: %s (%d)\n", message, buffer, (int)status);
  } else {
    fprintf(stderr, "%s (%d)\n", message, (int)status);
  }
  if (detail) CFRelease(detail);
  exit(1);
}

static OSStatus find_item(const char *account, UInt32 *length, void **data, SecKeychainItemRef *item) {
  return SecKeychainFindGenericPassword(
    NULL,
    (UInt32)strlen(SERVICE), SERVICE,
    (UInt32)strlen(account), account,
    length, data, item
  );
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "Invalid Keychain helper request\n");
    return 1;
  }
  const char *operation = argv[1];
  const char *account = argv[2];

  if (strcmp(operation, "store") == 0) {
    unsigned char secret[8193];
    size_t length = fread(secret, 1, sizeof(secret), stdin);
    if (ferror(stdin) || length == 0 || length > 8192) {
      fprintf(stderr, "Invalid Rig credential length\n");
      return 1;
    }
    SecKeychainItemRef item = NULL;
    OSStatus status = find_item(account, NULL, NULL, &item);
    if (status == errSecSuccess) {
      status = SecKeychainItemModifyAttributesAndData(item, NULL, (UInt32)length, secret);
      CFRelease(item);
      if (status != errSecSuccess) fail("Unable to update Rig credential", status);
    } else if (status == errSecItemNotFound || status == errSecParam) {
      status = SecKeychainAddGenericPassword(
        NULL,
        (UInt32)strlen(SERVICE), SERVICE,
        (UInt32)strlen(account), account,
        (UInt32)length, secret,
        NULL
      );
      if (status != errSecSuccess) fail("Unable to store Rig credential", status);
    } else {
      fail("Unable to inspect Rig credential", status);
    }
    memset(secret, 0, sizeof(secret));
    return 0;
  }

  if (strcmp(operation, "read") == 0) {
    UInt32 length = 0;
    void *data = NULL;
    SecKeychainItemRef item = NULL;
    OSStatus status = find_item(account, &length, &data, &item);
    if (status == errSecItemNotFound || status == errSecParam) {
      fail("Rig credential is missing from the macOS Keychain", errSecItemNotFound);
    }
    if (status != errSecSuccess) fail("Unable to read Rig credential", status);
    if (length > 0 && fwrite(data, 1, length, stdout) != length) {
      SecKeychainItemFreeContent(NULL, data);
      CFRelease(item);
      fprintf(stderr, "Unable to return Rig credential\n");
      return 1;
    }
    SecKeychainItemFreeContent(NULL, data);
    CFRelease(item);
    return 0;
  }

  if (strcmp(operation, "delete") == 0) {
    SecKeychainItemRef item = NULL;
    OSStatus status = find_item(account, NULL, NULL, &item);
    if (status == errSecItemNotFound || status == errSecParam) return 0;
    if (status != errSecSuccess) fail("Unable to inspect Rig credential", status);
    status = SecKeychainItemDelete(item);
    CFRelease(item);
    if (status != errSecSuccess) fail("Unable to delete Rig credential", status);
    return 0;
  }

  fprintf(stderr, "Unsupported Keychain helper operation\n");
  return 1;
}
