import { useState, useMemo, useRef, ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Upload,
  Flame,
  Timer,
  TrendingDown,
  Activity,
  Camera,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type Sex = "male" | "female";
type Units = "metric" | "imperial";

const KCAL_PER_KG_FAT = 7700;
const KCAL_PER_HIIT = 250;

function navyBodyFat(
  sex: Sex,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm: number,
) {
  if (sex === "male") {
    return (
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450
    );
  }
  return (
    495 /
      (1.29579 -
        0.35004 * Math.log10(waistCm + hipCm - neckCm) +
        0.221 * Math.log10(heightCm)) -
    450
  );
}

const HiitFatLossApp = () => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [resultPhoto, setResultPhoto] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sex, setSex] = useState<Sex>("male");
  const [units, setUnits] = useState<Units>("metric");
  const [weight, setWeight] = useState("80");
  const [height, setHeight] = useState("178");
  const [waist, setWaist] = useState("90");
  const [neck, setNeck] = useState("38");
  const [hip, setHip] = useState("95");
  const [goalKg, setGoalKg] = useState([5]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState([4]);

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024)
      return toast.error("Image too large (max 8MB)");
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setResultPhoto(null);
    };
    reader.readAsDataURL(f);
  };

  const result = useMemo(() => {
    const toCm = (v: number) => (units === "metric" ? v : v * 2.54);
    const toKg = (v: number) => (units === "metric" ? v : v * 0.453592);
    const h = toCm(parseFloat(height) || 0);
    const w = toCm(parseFloat(waist) || 0);
    const n = toCm(parseFloat(neck) || 0);
    const hp = toCm(parseFloat(hip) || 0);
    const wt = toKg(parseFloat(weight) || 0);
    if (h <= 0 || w <= 0 || n <= 0 || wt <= 0 || (sex === "female" && hp <= 0))
      return null;
    let bf = navyBodyFat(sex, h, w, n, hp);
    if (!isFinite(bf) || bf < 3 || bf > 60) return null;
    bf = Math.round(bf * 10) / 10;
    const fatMass = (bf / 100) * wt;
    const goal = goalKg[0];
    const totalKcal = goal * KCAL_PER_KG_FAT;
    const sessions = Math.ceil(totalKcal / KCAL_PER_HIIT);
    const perWeek = sessionsPerWeek[0];
    const weeks = Math.ceil(sessions / perWeek);
    const totalMinutes = sessions * 12;
    const newBf = Math.max(
      3,
      Math.round(((fatMass - goal) / (wt - goal)) * 1000) / 10,
    );
    return {
      bf,
      fatMass: Math.round(fatMass * 10) / 10,
      totalKcal,
      sessions,
      weeks,
      totalMinutes,
      newBf,
    };
  }, [sex, units, height, weight, waist, neck, hip, goalKg, sessionsPerWeek]);

  const unitLen = units === "metric" ? "cm" : "in";
  const unitW = units === "metric" ? "kg" : "lb";

  const generateResult = async () => {
    if (!photo || !result)
      return toast.error("Upload a photo and enter measurements first");
    setGenerating(true);
    setResultPhoto(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "transform-body",
        {
          body: {
            image: photo,
            goalKg: goalKg[0],
            currentBf: result.bf,
            newBf: result.newBf,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.image) throw new Error("No image returned");
      setResultPhoto(data.image);
      toast.success("Projected result generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate image");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="container py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SprintShred</h1>
            <p className="text-xs text-muted-foreground">
              Treadmill fat loss planner
            </p>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="mb-10 max-w-3xl">
          <h2 className="text-4xl font-bold leading-tight md:text-5xl">
            Burn fat with{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              sprints
            </span>
            , not slogs.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Upload a progress photo, enter a few measurements, and get a
            personalized HIIT plan to hit your fat-loss goal.
          </p>
          <p className="mt-4 text-white">
            HIIT stands for High-Intensity Interval Training — short bursts of
            all-out effort followed by rest.
          </p>
          <ul className="mt-4 text-muted-foreground list-disc list-inside">
            Example of HIIT on a treadmill:
            <li>Sprint hard for 30 seconds (as fast as you can)</li>
            <li>Walk slowly for 30 seconds (catch your breath)</li>
            <li>Repeat this 10–15 times (total ~10–15 minutes)</li>
          </ul>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="overflow-hidden border-border/50 bg-card/80 p-6 shadow-card backdrop-blur">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Camera className="h-4 w-4" /> Progress photo
            </h3>
            {photo ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <PhotoPane
                    label="Now"
                    src={photo}
                    onClick={() => fileRef.current?.click()}
                  />
                  <PhotoPane
                    label={`After −${goalKg[0]}kg`}
                    src={resultPhoto || photo}
                    highlight
                    placeholder={!resultPhoto}
                    loading={generating}
                    onClick={() => fileRef.current?.click()}
                  />
                </div>
                <Button
                  onClick={generateResult}
                  disabled={generating || !result}
                  className="mt-4 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Generating projected photo…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />{" "}
                      {resultPhoto ? "Regenerate" : "Generate"} projected result
                    </>
                  )}
                </Button>
              </>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="group relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-secondary/40 transition hover:border-primary hover:bg-secondary/60">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-10 w-10" />
                  <span className="text-sm">Click to upload</span>
                  <span className="text-xs">
                    We'll generate a projected after-photo
                  </span>
                </div>
              </button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              AI-generated projection based on your fat-loss goal. Illustrative
              only — not a medical or guaranteed result.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhoto}
            />
          </Card>

          <Card className="border-border/50 bg-card/80 p-6 shadow-card backdrop-blur">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="h-4 w-4" /> Your measurements
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Sex</Label>
                <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Units</Label>
                <Select
                  value={units}
                  onValueChange={(v) => setUnits(v as Units)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric (cm / kg)</SelectItem>
                    <SelectItem value="imperial">Imperial (in / lb)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Weight ({unitW})</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div>
                <Label>Height ({unitLen})</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <div>
                <Label>Waist ({unitLen})</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                />
              </div>
              <div>
                <Label>Neck ({unitLen})</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={neck}
                  onChange={(e) => setNeck(e.target.value)}
                />
              </div>
              {sex === "female" && (
                <div className="sm:col-span-2">
                  <Label>Hip ({unitLen})</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    value={hip}
                    onChange={(e) => setHip(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 space-y-5 border-t border-border/50 pt-5">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <Label>Fat-loss goal</Label>
                  <span className="font-semibold text-primary">
                    {goalKg[0]} kg
                  </span>
                </div>
                <Slider
                  value={goalKg}
                  onValueChange={setGoalKg}
                  min={1}
                  max={20}
                  step={0.5}
                />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <Label>HIIT(Treadmill) sessions per week</Label>
                  <span className="font-semibold text-primary">
                    {sessionsPerWeek[0]}
                  </span>
                </div>
                <Slider
                  value={sessionsPerWeek}
                  onValueChange={setSessionsPerWeek}
                  min={2}
                  max={6}
                  step={1}
                />
              </div>
            </div>
          </Card>
        </div>

        {result ? (
          <Card className="mt-6 overflow-hidden border-border/50 bg-card/80 p-8 shadow-card backdrop-blur">
            <div className="grid gap-6 md:grid-cols-4">
              <Stat
                icon={<TrendingDown className="h-5 w-5" />}
                label="Body fat (Navy)"
                value={`${result.bf}%`}
                sub={`≈ ${result.fatMass} kg fat`}
              />
              <Stat
                icon={<Flame className="h-5 w-5" />}
                label="Calories to burn"
                value={result.totalKcal.toLocaleString()}
                sub="kcal total"
              />
              <Stat
                icon={<Activity className="h-5 w-5" />}
                label="HIIT sessions"
                value={String(result.sessions)}
                sub={`${KCAL_PER_HIIT} kcal each`}
              />
              <Stat
                icon={<Timer className="h-5 w-5" />}
                label="Time to goal"
                value={`${result.weeks} wks`}
                sub={`${Math.round(result.totalMinutes / 60)} h sprinting`}
              />
            </div>
            <div className="mt-6 rounded-lg bg-gradient-primary p-5 text-primary-foreground shadow-glow">
              <p className="text-sm md:text-base">
                Based on your data, you need{" "}
                <b>~{result.sessions} HIIT(Treadmill) sessions</b> (30s sprint /
                30s walk × ~12 min). That's{" "}
                <b>{Math.round(result.totalMinutes / 60)} hours</b> of
                sprinting. At <b>{sessionsPerWeek[0]} sessions/week</b>, you'll
                lose{" "}
                <b>
                  {goalKg[0]} kg fat in ~{result.weeks} weeks
                </b>
                , dropping to ~{result.newBf}% body fat.
              </p>
            </div>
            {/* <p className="mt-4 text-xs text-muted-foreground">
              Estimates only. Real body composition requires calipers, tape, or
              a DEXA scan. Calorie burn varies by intensity and individual
              physiology.
            </p> */}
          </Card>
        ) : (
          <Card className="mt-6 border-border/50 bg-card/60 p-6 text-center text-sm text-muted-foreground backdrop-blur">
            Enter valid measurements to see your plan.
          </Card>
        )}
      </main>
      <footer className="center p-3 flex items-center justify-center flex-col gap-1 text-center text-muted-foreground">
        <p className="bg-gradient-primary bg-clip-text text-transparent">
          By Usman Akram - 2026 @ All Rights Reserved
        </p>
        <p className="bg-gradient-primary bg-clip-text text-transparent">
          Contact:{" "}
          <a href="mailto:usmanakram4118@gmail.com" className="underline">
            usmanakram4118@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
};

const Stat = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) => (
  <div className="rounded-lg border border-border/50 bg-secondary/40 p-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
    <div className="mt-2 text-2xl font-bold">{value}</div>
    <div className="text-xs text-muted-foreground">{sub}</div>
  </div>
);

const PhotoPane = ({
  label,
  src,
  highlight,
  placeholder,
  loading,
  onClick,
}: {
  label: string;
  src: string;
  highlight?: boolean;
  placeholder?: boolean;
  loading?: boolean;
  onClick: () => void;
}) => (
  <div className="flex flex-col gap-2">
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-lg border ${
        highlight ? "border-primary shadow-glow" : "border-border/50"
      } bg-secondary/40`}>
      <img
        src={src}
        alt={label}
        onClick={onClick}
        className={`h-full w-full cursor-pointer object-cover transition ${placeholder ? "opacity-30 blur-sm" : ""}`}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {placeholder && !loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            Click "Generate" below
          </span>
        </div>
      )}
      <span
        className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
          highlight
            ? "bg-gradient-primary text-primary-foreground"
            : "bg-background/80 text-foreground"
        }`}>
        {label}
      </span>
    </div>
  </div>
);

export default HiitFatLossApp;
