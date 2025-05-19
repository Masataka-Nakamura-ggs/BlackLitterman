import * as math from 'mathjs';

// --- 型定義 ---
type Vector = number[];
type Matrix = number[][];

/**
 * ブラックリッターマンモデルへの入力
 */
interface BlackLittermanInputs {
    /** tau: スカラー。事前分布（均衡リターン）の不確実性。小さいほど事前分布への信頼度が高い。(例: 0.025) */
    tau: number;
    /** P: KxN 行列。投資家のビューのピッキング行列。Kはビューの数、Nは資産の数。 */
    P: Matrix;
    /** Q: Kx1 ベクトル。投資家のビューに対応する期待リターン。 */
    Q: Vector;
    /** Omega: KxK 行列。ビューの誤差の共分散行列（通常は対角行列）。対角要素が小さいほどビューへの確信度が高い。 */
    Omega: Matrix;
    /** marketCovariance: NxN 行列 (S)。資産リターンの共分散行列。 */
    marketCovariance: Matrix;
    /** marketCapWeights: Nx1 ベクトル (w_mkt)。市場ポートフォリオの各資産のウェイト。 */
    marketCapWeights: Vector;
    /** riskAversion: スカラー (delta)。市場のリスク回避係数。 */
    riskAversion: number;
}

/**
 * ブラックリッターマンモデルからの出力
 */
interface BlackLittermanOutputs {
    /** posteriorReturns: Nx1 ベクトル。ビューを反映した事後期待リターン。 */
    posteriorReturns: Vector;
    /** posteriorCovariance: NxN 行列。ビューを反映した事後共分散行列（ここでは簡易的に事前共分散を返すか、より複雑な計算も可能）。 */
    posteriorCovariance: Matrix;
    /** equilibriumReturns: Nx1 ベクトル。均衡期待リターン。 */
    equilibriumReturns: Vector;
}

// --- 行列・ベクトル演算のヘルパー関数 (mathjs を使用) ---

function transpose(matrix: Matrix): Matrix {
    return math.transpose(matrix) as Matrix;
}

function multiply(A: math.MathType, B: math.MathType): math.MathType {
    return math.multiply(A, B);
}

function inverse(matrix: Matrix): Matrix {
    try {
        return math.inv(matrix) as Matrix;
    } catch (e) {
        console.error("Matrix inversion failed. The matrix might be singular.", matrix);
        throw new Error(`Matrix inversion failed: ${e}`);
    }
}

function add(A: math.MathType, B: math.MathType): math.MathType {
    return math.add(A, B);
}

function subtract(A: math.MathType, B: math.MathType): math.MathType {
    return math.subtract(A, B);
}

// ベクトルを列ベクトル (Nx1行列) に変換
function toColumnMatrix(vector: Vector): Matrix {
    return vector.map(v => [v]);
}

// Nx1行列をベクトルに変換
function toVector(matrix: Matrix): Vector {
    return matrix.map(row => row[0]);
}


// --- ブラックリッターマンモデルのコアロジック ---

/**
 * 均衡期待リターン (Implied Equilibrium Returns) を計算します。
 * Π = δ * S * w_mkt
 * @param riskAversion リスク回避係数 (δ)
 * @param S 市場の共分散行列 (N x N)
 * @param wMkt 市場ポートフォリオのウェイト (N x 1)
 * @returns 均衡期待リターンベクトル (N x 1)
 */
function calculateEquilibriumReturns(
    riskAversion: number,
    S: Matrix,
    wMkt: Vector
): Vector {
    if (S.length === 0 || S[0].length !== wMkt.length) {
        throw new Error("Dimension mismatch: marketCovariance (S) and marketCapWeights (wMkt).");
    }
    if (S.length !== S[0].length) {
        throw new Error("marketCovariance (S) must be a square matrix.");
    }

    const wMktCol = toColumnMatrix(wMkt); // N x 1
    const S_times_wMkt = multiply(S, wMktCol) as Matrix; // (N x N) * (N x 1) = N x 1
    const equilibriumReturnsMatrix = multiply(riskAversion, S_times_wMkt) as Matrix; // N x 1

    return toVector(equilibriumReturnsMatrix);
}

/**
 * ブラックリッターマンの事後期待リターン (Posterior Expected Returns) を計算します。
 * E[R] = Π + (τS)Pᵀ[P(τS)Pᵀ + Ω]⁻¹(Q - PΠ)
 *
 * @param tau 事前分布の不確実性を示すスカラー
 * @param S 市場の共分散行列 (N x N)
 * @param Pi_eq 均衡期待リターンベクトル (N x 1)
 * @param P ビューのピッキング行列 (K x N)
 * @param Q ビューの期待リターンベクトル (K x 1)
 * @param Omega ビューの誤差の共分散行列 (K x K)
 * @returns 事後期待リターンベクトル (N x 1)
 */
function calculateBlackLittermanPosteriorReturns(
    tau: number,
    S: Matrix,
    Pi_eq: Vector,
    P: Matrix,
    Q: Vector,
    Omega: Matrix
): Vector {
    const N = S.length; // 資産数
    const K = Q.length; // ビューの数

    if (P.length !== K || (P[0] && P[0].length !== N)) {
        throw new Error("Dimension mismatch for P matrix.");
    }
    if (Omega.length !== K || (Omega[0] && Omega[0].length !== K)) {
        throw new Error("Dimension mismatch for Omega matrix.");
    }
    if (Pi_eq.length !== N) {
        throw new Error("Dimension mismatch for equilibrium returns Pi_eq.");
    }

    const Pi_eq_col = toColumnMatrix(Pi_eq); // N x 1
    const Q_col = toColumnMatrix(Q);       // K x 1

    // τ * S
    const tauS: Matrix = multiply(tau, S) as Matrix; // N x N

    // P * Π
    const P_Pi = multiply(P, Pi_eq_col) as Matrix; // (K x N) * (N x 1) = K x 1

    // Q - P * Π (ビューの超過リターン)
    const Q_minus_P_Pi = subtract(Q_col, P_Pi) as Matrix; // K x 1

    // P * (τS)
    const P_tauS = multiply(P, tauS) as Matrix; // (K x N) * (N x N) = K x N

    // P * (τS) * Pᵀ
    const P_tauS_PT = multiply(P_tauS, transpose(P)) as Matrix; // (K x N) * (N x K) = K x K

    // P * (τS) * Pᵀ + Ω
    const bracket_term_inv_target = add(P_tauS_PT, Omega) as Matrix; // K x K

    // [P * (τS) * Pᵀ + Ω]⁻¹
    const bracket_term_inverted = inverse(bracket_term_inv_target); // K x K

    // (τS) * Pᵀ
    const tauS_PT = multiply(tauS, transpose(P)) as Matrix; // (N x N) * (N x K) = N x K

    // (τS)Pᵀ[P(τS)Pᵀ + Ω]⁻¹
    const right_multiplier = multiply(tauS_PT, bracket_term_inverted) as Matrix; // (N x K) * (K x K) = N x K

    // (τS)Pᵀ[P(τS)Pᵀ + Ω]⁻¹(Q - PΠ)
    const adjustment_matrix = multiply(right_multiplier, Q_minus_P_Pi) as Matrix; // (N x K) * (K x 1) = N x 1

    // E[R] = Π + adjustment
    const posteriorReturnsMatrix = add(Pi_eq_col, adjustment_matrix) as Matrix; // N x 1

    return toVector(posteriorReturnsMatrix);
}

// --- メイン関数 ---
/**
 * ブラックリッターマンモデルを実行します。
 * @param inputs ブラックリッターマンモデルへの入力
 * @returns ブラックリッターマンモデルからの出力
 */
function runBlackLitterman(inputs: BlackLittermanInputs): BlackLittermanOutputs {
    const {
        tau,
        P,
        Q,
        Omega,
        marketCovariance,
        marketCapWeights,
        riskAversion,
    } = inputs;

    // 1. 均衡期待リターン (Π) を計算
    const equilibriumReturns = calculateEquilibriumReturns(
        riskAversion,
        marketCovariance,
        marketCapWeights
    );

    // 2. 事後期待リターン (E[R]) を計算
    const posteriorReturns = calculateBlackLittermanPosteriorReturns(
        tau,
        marketCovariance,
        equilibriumReturns,
        P,
        Q,
        Omega
    );

    // 注意: ブラックリッターマンモデルにおける事後共分散行列も導出可能です。
    // M_posterior_inv = (tau*S)^-1 + P^T * Omega^-1 * P
    // M_posterior = (M_posterior_inv)^-1
    // ポートフォリオ最適化には、この事後共分散行列、あるいは単純化して元の市場共分散行列 (S) を使用します。
    // ここでは、簡潔さのために元の marketCovariance を返しますが、必要に応じて事後共分散を計算してください。
    // const tauS_inv = inverse(multiply(tau, marketCovariance) as Matrix);
    // const PT_Omega_inv = multiply(transpose(P), inverse(Omega)) as Matrix;
    // const PT_Omega_inv_P = multiply(PT_Omega_inv, P) as Matrix;
    // const M_posterior_inv = add(tauS_inv, PT_Omega_inv_P) as Matrix;
    // const posteriorCovariance = inverse(M_posterior_inv);

    return {
        posteriorReturns,
        posteriorCovariance: marketCovariance, // または上記で計算した posteriorCovariance
        equilibriumReturns,
    };
}

// --- 使用例 ---
function exampleUsage() {
    console.log("--- ブラックリッターマンモデル実行例 ---");

    // 例：3資産、2つのビュー
    const numAssets = 3;
    const numViews = 2;

    // 市場データ
    const marketCovariance: Matrix = [ // S (NxN)
        [0.0225, 0.0068, 0.0033], // 例: [Asset1_Var, Asset1_Asset2_Cov, Asset1_Asset3_Cov]
        [0.0068, 0.0289, 0.0078], // 例: [Asset2_Asset1_Cov, Asset2_Var, Asset2_Asset3_Cov]
        [0.0033, 0.0078, 0.0441], // 例: [Asset3_Asset1_Cov, Asset3_Asset2_Cov, Asset3_Var]
    ];
    const marketCapWeights: Vector = [0.5, 0.3, 0.2]; // w_mkt (Nx1) - 合計100%
    const riskAversion: number = 3.0; // delta - リスク回避係数

    // 投資家のビュー
    // P (KxN): 各行が1つのビュー。
    // ビュー1: 資産1が資産2を1%アウトパフォームする (Asset1 - Asset2 = 0.01)
    // ビュー2: 資産3が絶対リターンで4%となる (Asset3 = 0.04)
    const P: Matrix = [
        [1, -1, 0],
        [0,  0, 1],
    ];
    const Q: Vector = [0.01, 0.04]; // Q (Kx1): ビューに対応するリターン

    // Omega (KxK): ビューの不確実性 (分散)。対角要素が小さいほど確信度が高い。
    // 通常は対角行列。非対角要素はビュー間の相関。
    const view1Variance = 0.0001; // ビュー1の誤差の分散 (標準偏差0.01)
    const view2Variance = 0.0005; // ビュー2の誤差の分散 (標準偏差 approx 0.022)
    const Omega: Matrix = [
        [view1Variance, 0],
        [0, view2Variance],
    ];

    const tau: number = 0.05; // 事前分布の不確実性に関するスカラー

    const inputs: BlackLittermanInputs = {
        tau,
        P,
        Q,
        Omega,
        marketCovariance,
        marketCapWeights,
        riskAversion,
    };

    try {
        const outputs = runBlackLitterman(inputs);

        console.log("\n入力データ:");
        console.log("Tau:", tau);
        console.log("P (ビュー行列):"); P.forEach(row => console.log(row));
        console.log("Q (ビューリターン):", Q);
        console.log("Omega (ビュー誤差共分散):"); Omega.forEach(row => console.log(row));
        console.log("市場共分散行列 S:"); marketCovariance.forEach(row => console.log(row));
        console.log("市場ウェイト w_mkt:", marketCapWeights);
        console.log("リスク回避係数 delta:", riskAversion);

        console.log("\n--- モデル出力 ---");
        console.log("均衡期待リターン (Π):");
        outputs.equilibriumReturns.forEach((ret, i) => console.log(`  資産 ${i+1}: ${(ret * 100).toFixed(3)}%`));

        console.log("\n事後期待リターン (E[R]):");
        outputs.posteriorReturns.forEach((ret, i) => console.log(`  資産 ${i+1}: ${(ret * 100).toFixed(3)}%`));

        // console.log("\n事後共分散行列 (Posterior Covariance):"); // 必要であれば表示
        // outputs.posteriorCovariance.forEach(row => console.log(row.map(val => val.toFixed(5))));

        console.log("\n--- 次のステップ ---");
        console.log("上記の事後期待リターンと（事後または事前の）共分散行列を使用して、ポートフォリオ最適化を行います。");

    } catch (error) {
        if (error instanceof Error) {
            console.error("ブラックリッターマンモデルの計算中にエラーが発生しました:", error.message);
        } else {
            console.error("ブラックリッターマンモデルの計算中に不明なエラーが発生しました:", error);
        }
    }
}

// 使用例を実行
exampleUsage();

/*
実行方法:
1. このコードを `blackLitterman.ts` のようなファイル名で保存します。
2. Node.js と TypeScript がインストールされていることを確認します。
   `npm install -g typescript ts-node`
3. mathjs をインストールします。
   `npm install mathjs @types/mathjs`
4. ターミナルで以下を実行します。
   `node --loader ts-node/esm blackLitterman.ts`
*/