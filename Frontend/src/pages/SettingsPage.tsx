// Settings Page Component

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/useAuthStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Separator } from "../components/ui/separator";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  User,
  Shield,
  Bell,
  Palette,
  CheckCircle2,
  Settings,
  Save,
  LogOut,
} from "lucide-react";

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, refreshProfile } = useAuthStore();

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    department: user?.department || "",
    licenseNumber: user?.licenseNumber || "",
  });

  const [preferences, setPreferences] = useState({
    theme: "system",
    notifications: true,
    emailAlerts: true,
    heatmapOpacity: 60,
    autoRefresh: true,
    soundAlerts: false,
    language: "en",
  });

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        department: user.department || "",
        licenseNumber: user.licenseNumber || "",
      });
    }
  }, [user]);

  const handleProfileSave = async () => {
    setSaveStatus("saving");
    try {
      await refreshProfile();
      setSaveStatus("saved");

      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handlePreferencesSave = () => {
    setSaveStatus("saving");
    try {
      // Save to localStorage or make API call
      localStorage.setItem("afyadx-preferences", JSON.stringify(preferences));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center">
                  <Settings className="w-6 h-6 mr-2 text-blue-600" />
                  Settings
                </h1>
                <p className="text-slate-600">
                  Manage your account and preferences
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {saveStatus === "saved" && (
                <Alert className="py-2 px-3 bg-green-50 border-green-200 text-green-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <AlertDescription className="ml-2">
                    Settings saved
                  </AlertDescription>
                </Alert>
              )}

              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-fit">
            <TabsTrigger
              value="profile"
              className="flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="flex items-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center space-x-2"
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="flex items-center space-x-2"
            >
              <Palette className="w-4 h-4" />
              <span>Preferences</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Update your personal details and professional information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-700">
                          Full Name
                        </Label>
                        <Input
                          id="name"
                          value={profileData.name}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="border-slate-300 focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-700">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          className="border-slate-300 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="department" className="text-slate-700">
                          Department
                        </Label>
                        <Input
                          id="department"
                          value={profileData.department}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              department: e.target.value,
                            }))
                          }
                          className="border-slate-300 focus:border-blue-500"
                          placeholder="e.g. Radiology"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="license" className="text-slate-700">
                          License Number
                        </Label>
                        <Input
                          id="license"
                          value={profileData.licenseNumber}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              licenseNumber: e.target.value,
                            }))
                          }
                          className="border-slate-300 focus:border-blue-500"
                          placeholder="Medical license number"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleProfileSave}
                      disabled={saveStatus === "saving"}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saveStatus === "saving" ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Account Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Role</span>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {user?.role || "N/A"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Status</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Last Login</span>
                      <span className="text-sm text-slate-900">
                        {user?.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>

                    <Separator />

                    <div className="text-xs text-slate-500">
                      Member since{" "}
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your account security and authentication preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Password changes and advanced security settings are managed
                    by your system administrator. Contact your IT department for
                    assistance.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-slate-900">
                        Two-Factor Authentication
                      </h4>
                      <p className="text-sm text-slate-600">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-300"
                    >
                      Managed by Admin
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-slate-900">
                        Session Management
                      </h4>
                      <p className="text-sm text-slate-600">
                        Manage active sessions and login history
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-300"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to be notified about important updates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="notifications"
                        className="text-base font-medium"
                      >
                        Push Notifications
                      </Label>
                      <p className="text-sm text-slate-600">
                        Receive notifications about urgent cases and system
                        updates
                      </p>
                    </div>
                    <Switch
                      id="notifications"
                      checked={preferences.notifications}
                      onCheckedChange={(checked: boolean) =>
                        setPreferences((prev) => ({
                          ...prev,
                          notifications: checked,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="email-alerts"
                        className="text-base font-medium"
                      >
                        Email Alerts
                      </Label>
                      <p className="text-sm text-slate-600">
                        Get email notifications for status changes and reports
                      </p>
                    </div>
                    <Switch
                      id="email-alerts"
                      checked={preferences.emailAlerts}
                      onCheckedChange={(checked: boolean) =>
                        setPreferences((prev) => ({
                          ...prev,
                          emailAlerts: checked,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="sound-alerts"
                        className="text-base font-medium"
                      >
                        Sound Alerts
                      </Label>
                      <p className="text-sm text-slate-600">
                        Play sound notifications for urgent cases
                      </p>
                    </div>
                    <Switch
                      id="sound-alerts"
                      checked={preferences.soundAlerts}
                      onCheckedChange={(checked: boolean) =>
                        setPreferences((prev) => ({
                          ...prev,
                          soundAlerts: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={handlePreferencesSave}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Display Preferences</CardTitle>
                  <CardDescription>
                    Customize your viewing experience and interface settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="theme" className="text-base font-medium">
                        Theme
                      </Label>
                      <Select
                        value={preferences.theme}
                        onValueChange={(value: string) =>
                          setPreferences((prev) => ({ ...prev, theme: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="language"
                        className="text-base font-medium"
                      >
                        Language
                      </Label>
                      <Select
                        value={preferences.language}
                        onValueChange={(value: string) =>
                          setPreferences((prev) => ({
                            ...prev,
                            language: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">
                        Default Heatmap Opacity: {preferences.heatmapOpacity}%
                      </Label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={preferences.heatmapOpacity}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            heatmapOpacity: Number(e.target.value),
                          }))
                        }
                        className="w-full mt-2"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">
                          Auto-refresh Cases
                        </Label>
                        <p className="text-sm text-slate-600">
                          Automatically refresh the case queue every 30 seconds
                        </p>
                      </div>
                      <Switch
                        checked={preferences.autoRefresh}
                        onCheckedChange={(checked: boolean) =>
                          setPreferences((prev) => ({
                            ...prev,
                            autoRefresh: checked,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handlePreferencesSave}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
