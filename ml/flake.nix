{
  description = "SmartSales ML Service";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    
    # Use 3.12 for maximum compatibility with ML libs and Supabase
    python = pkgs.python312;

    pythonEnv = python.withPackages (ps: with ps; [
  fastapi uvicorn pydantic python-multipart requests python-dotenv
  pandas numpy torch scikit-learn psycopg2 httpx
    ]);
  in {
    devShells.${system}.default = pkgs.mkShell {
      buildInputs = [
        pythonEnv
        pkgs.libpqxx
        pkgs.postgresql # Provides pg_config often needed by psycopg2
      ];

      shellHook = ''
  export PYTHONPATH=$PWD
  if [ ! -d .venv ]; then
    uv venv .venv
    uv pip install supabase
  fi
  source .venv/bin/activate
      '';
    };
  };
}